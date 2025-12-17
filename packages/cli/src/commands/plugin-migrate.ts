import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { resolveEnvVars, loadEnvFile } from "@yamajs/core";
import { success, error, info, warning, printBox } from "../utils/cli-utils.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { confirm, promptInput } from "../utils/interactive.ts";
import {
  loadPlugin,
  getAllPlugins,
  getPluginByCategory,
} from "@yamajs/core";
import {
  ensurePluginMigrationTables,
  getInstalledPluginVersion,
  getPendingPluginMigrations,
  getPluginPackageDir,
  // Phase 1 Safety imports
  MigrationRunner,
  analyzeMigrationSafety,
  analyzeMultipleMigrations,
  formatSafetyAnalysis,
  getConfirmationPrompt,
  validateConfirmation,
} from "@yamajs/core";
import {
  getMigrationPlan,
  formatMigrationPlan,
} from "@yamajs/core";
import type { MigrationSafetyAnalysis } from "@yamajs/core";

interface PluginMigrateOptions {
  plugin?: string;
  all?: boolean;
  dryRun?: boolean;
  config?: string;
  env?: string;
  force?: boolean;
  skipConfirm?: boolean;
  interactive?: boolean;
}

/**
 * Format risk level with appropriate emoji
 */
function formatRiskLevel(level: string): string {
  const badges: Record<string, string> = {
    low: "✅ LOW RISK",
    medium: "⚠️  MEDIUM RISK",
    high: "🔶 HIGH RISK",
    critical: "🔴 CRITICAL RISK",
  };
  return badges[level] || level;
}

/**
 * Display safety analysis to user
 */
function displaySafetyAnalysis(analysis: MigrationSafetyAnalysis, pluginName: string): void {
  console.log();
  console.log(`  ${formatRiskLevel(analysis.riskLevel)}`);
  console.log();

  if (analysis.destructiveOperations.length > 0) {
    console.log("  Destructive Operations:");
    for (const op of analysis.destructiveOperations) {
      const icon = op.severity === "danger" ? "🔴" : "⚠️";
      const reversibleNote = op.reversible ? "" : " (IRREVERSIBLE)";
      console.log(`    ${icon} ${op.type}: ${op.target}${reversibleNote}`);
      console.log(`       ${op.message}`);
    }
    console.log();
  }

  if (analysis.warnings.length > 0) {
    console.log("  Warnings:");
    for (const w of analysis.warnings) {
      console.log(`    ${w}`);
    }
    console.log();
  }

  if (analysis.affectedTables.length > 0) {
    console.log(`  Affected Tables: ${analysis.affectedTables.join(", ")}`);
    console.log();
  }

  if (analysis.requiresBackup) {
    warning("  📦 Recommendation: Create a backup before proceeding");
  }
}

export async function pluginMigrateCommand(
  options: PluginMigrateOptions
): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    console.log("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
      database?: any;
    };
    config = resolveEnvVars(config) as typeof config;
    const configDir = getConfigDir(configPath);

    // Safety check: production environment warning
    const isProduction = environment === "production" || environment === "prod";
    if (isProduction && !options.force && !options.dryRun) {
      warning("⚠️  WARNING: You are about to run migrations in PRODUCTION!");
      warning("   This operation will modify your production database.");
      warning("   Consider testing migrations in staging first.");
      console.log();

      if (!options.skipConfirm) {
        const confirmed = await confirm(
          "Are you absolutely sure you want to continue?",
          false
        );
        if (!confirmed) {
          info("Migration cancelled.");
          return;
        }
      }
    }

    // Get database plugin
    let dbPlugin;
    try {
      dbPlugin = await getDatabasePlugin(config.plugins, configPath);
    } catch (err) {
      error(
        `No database plugin found. Plugin migrations require a database plugin.`
      );
      process.exit(1);
    }

    // Initialize database connection
    if (config.database) {
      await dbPlugin.client.initDatabase(config.database);
    } else {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    const sql = dbPlugin.client.getSQL();

    // Ensure migration tables exist
    await ensurePluginMigrationTables(sql);

    // Get plugins to migrate
    const pluginsToMigrate: string[] = [];
    if (options.plugin) {
      pluginsToMigrate.push(options.plugin);
    } else if (options.all) {
      // Get all plugins from config
      if (config.plugins) {
        const pluginList = Array.isArray(config.plugins)
          ? config.plugins
          : Object.keys(config.plugins);
        pluginsToMigrate.push(...pluginList);
      }
    } else {
      // Default: migrate all plugins with pending migrations
      if (config.plugins) {
        const pluginList = Array.isArray(config.plugins)
          ? config.plugins
          : Object.keys(config.plugins);
        pluginsToMigrate.push(...pluginList);
      }
    }

    if (pluginsToMigrate.length === 0) {
      info("No plugins configured");
      return;
    }

    if (options.dryRun) {
      info("🔍 Dry run mode - no changes will be made\n");
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const pluginName of pluginsToMigrate) {
      try {
        // Load plugin
        const plugin = await loadPlugin(pluginName, configDir);
        const manifest = plugin.manifest;

        if (!manifest || !manifest.migrations || Object.keys(manifest.migrations).length === 0) {
          skippedCount++;
          continue;
        }

        // Get installed version
        const installedVersion = await getInstalledPluginVersion(
          pluginName,
          sql
        );

        // Get current version
        const currentVersion = plugin.version || "0.0.0";

        // Get migration plan
        const plan = await getMigrationPlan(
          plugin,
          manifest,
          installedVersion,
          currentVersion
        );

        if (plan.migrations.length === 0) {
          skippedCount++;
          continue;
        }

        // Show plan
        console.log(`\n${formatMigrationPlan(plan)}`);

        // Get plugin directory early for safety analysis
        const pluginDir = await getPluginPackageDir(pluginName, configDir);

        // Create migration runner
        const runner = new MigrationRunner(sql, {
          transactional: true,
          dryRun: options.dryRun || false,
          force: options.force || false,
          logger: {
            info: (msg: string) => info(`  ${msg}`),
            warn: (msg: string) => warning(`  ${msg}`),
            error: (msg: string) => error(`  ${msg}`),
          },
        });

        // Run with safety analysis
        const result = await runner.run(plugin, manifest, plan.migrations, pluginDir);

        // Display safety analysis if there are concerns
        if (!result.safetyAnalysis.safe) {
          displaySafetyAnalysis(result.safetyAnalysis, pluginName);
        }

        // If not dry run and requires confirmation, prompt user
        if (!options.dryRun && result.safetyAnalysis.requiresConfirmation && !options.force) {
          if (options.skipConfirm) {
            warning(`  ⚠️  Skipping destructive operations (use --force to override)`);
            skippedCount++;
            continue;
          }

          // For critical operations, require typing the operation
          const prompt = getConfirmationPrompt(result.safetyAnalysis);
          console.log();
          console.log(`  ⚠️  ${prompt}`);

          const input = await promptInput("  > ");

          if (!validateConfirmation(input, result.safetyAnalysis)) {
            warning("  Confirmation failed, skipping plugin");
            skippedCount++;
            continue;
          }

          // Re-run without dry-run flag since we now have confirmation
          const confirmedRunner = new MigrationRunner(sql, {
            transactional: true,
            dryRun: false,
            force: true, // User confirmed
            logger: {
              info: (msg: string) => info(`  ${msg}`),
              warn: (msg: string) => warning(`  ${msg}`),
              error: (msg: string) => error(`  ${msg}`),
            },
          });

          const confirmedResult = await confirmedRunner.run(plugin, manifest, plan.migrations, pluginDir);

          if (confirmedResult.success) {
            success(`  ✅ Migrated ${pluginName} (${confirmedResult.migrationsRun} migration(s) in ${confirmedResult.duration}ms)`);
            migratedCount++;
          } else {
            error(`  ❌ Migration failed for ${pluginName}`);
            if (confirmedResult.failedMigration) {
              error(`     Version ${confirmedResult.failedMigration.version}: ${confirmedResult.failedMigration.error.message}`);
            }
            if (confirmedResult.rolledBack) {
              info(`  ↩️  Transaction rolled back, no changes made`);
            }
            failedCount++;
          }
        } else if (!options.dryRun) {
          // Non-destructive migration, proceed directly
          if (result.success) {
            success(`  ✅ Migrated ${pluginName} (${result.migrationsRun} migration(s) in ${result.duration}ms)`);
            migratedCount++;
          } else {
            error(`  ❌ Migration failed for ${pluginName}`);
            if (result.failedMigration) {
              error(`     Version ${result.failedMigration.version}: ${result.failedMigration.error.message}`);
            }
            if (result.rolledBack) {
              info(`  ↩️  Transaction rolled back, no changes made`);
            }
            failedCount++;
          }
        } else {
          // Dry run
          info(`  Would migrate ${pluginName} (dry run, ${plan.migrations.length} migration(s))`);
        }

        // Interactive confirmation for next plugin
        if (options.interactive && !options.skipConfirm && pluginsToMigrate.indexOf(pluginName) < pluginsToMigrate.length - 1) {
          const continueNext = await confirm("Continue to next plugin?", true);
          if (!continueNext) {
            info("Migration stopped by user");
            break;
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("Cannot find module") || errorMsg.includes("not found")) {
          warning(`Plugin ${pluginName} not found, skipping`);
          skippedCount++;
        } else {
          error(`Failed to migrate ${pluginName}: ${errorMsg}`);
          failedCount++;
          // Continue with other plugins
        }
      }
    }

    // Close database connection
    await dbPlugin.client.closeDatabase();

    // Summary
    console.log("\n📊 Summary:");
    if (migratedCount > 0) {
      success(`Migrated: ${migratedCount} plugin(s)`);
    }
    if (skippedCount > 0) {
      info(`Skipped: ${skippedCount} plugin(s)`);
    }
    if (failedCount > 0) {
      error(`Failed: ${failedCount} plugin(s)`);
    }
    if (migratedCount === 0 && skippedCount === 0 && failedCount === 0) {
      info("No migrations to apply");
    }

    // Exit with error code if any failures
    if (failedCount > 0 && !options.dryRun) {
      process.exit(1);
    }
  } catch (err) {
    error(`Failed to run plugin migrations: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
