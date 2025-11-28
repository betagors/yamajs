import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig, resolveEnvVars, loadEnvFile } from "../utils/file-utils.ts";
import { success, error, info, warning } from "../utils/cli-utils.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import {
  loadPlugin,
  getAllPlugins,
  getPluginByCategory,
} from "@betagors/yama-core";
import {
  ensurePluginMigrationTables,
  getInstalledPluginVersion,
  getPendingPluginMigrations,
  executePluginMigration,
  updatePluginVersion,
  getPluginPackageDir,
} from "@betagors/yama-core";
import {
  getMigrationPlan,
  formatMigrationPlan,
} from "@betagors/yama-core";

interface PluginMigrateOptions {
  plugin?: string;
  all?: boolean;
  dryRun?: boolean;
  config?: string;
  env?: string;
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

        if (options.dryRun) {
          info(`Would migrate ${pluginName} (dry run)`);
          continue;
        }

        // Get plugin directory
        const pluginDir = await getPluginPackageDir(pluginName, configDir);

        // Execute migrations
        for (const migration of plan.migrations) {
          try {
            // Call onBeforeMigrate hook if present
            if (plugin.onBeforeMigrate) {
              await plugin.onBeforeMigrate(
                migration.fromVersion,
                migration.toVersion
              );
            }

            // Execute migration
            await executePluginMigration(migration, sql, pluginDir);

            success(
              `Migrated ${pluginName} from ${migration.fromVersion} to ${migration.toVersion}`
            );

            // Call onAfterMigrate hook if present
            if (plugin.onAfterMigrate) {
              await plugin.onAfterMigrate(
                migration.fromVersion,
                migration.toVersion
              );
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);

            // Call onMigrationError hook if present
            if (plugin.onMigrationError) {
              await plugin.onMigrationError(
                err instanceof Error ? err : new Error(errorMsg),
                migration.fromVersion,
                migration.toVersion
              );
            }

            error(
              `Migration failed for ${pluginName} from ${migration.fromVersion} to ${migration.toVersion}: ${errorMsg}`
            );
            throw err; // Stop on error
          }
        }

        // Update version record
        await updatePluginVersion(pluginName, currentVersion, sql);
        migratedCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("Cannot find module") || errorMsg.includes("not found")) {
          warning(`Plugin ${pluginName} not found, skipping`);
          skippedCount++;
        } else {
          error(`Failed to migrate ${pluginName}: ${errorMsg}`);
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
    if (migratedCount === 0 && skippedCount === 0) {
      info("No migrations to apply");
    }
  } catch (err) {
    error(`Failed to run plugin migrations: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

