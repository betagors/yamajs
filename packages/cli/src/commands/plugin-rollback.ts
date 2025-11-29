import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { resolveEnvVars, loadEnvFile } from "@betagors/yama-core";
import { success, error, info, warning, printBox, printTable } from "../utils/cli-utils.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { confirm } from "../utils/interactive.ts";
import { loadPlugin } from "@betagors/yama-core";
import {
  ensurePluginMigrationTables,
  rollbackPluginMigration,
  getPluginPackageDir,
  getInstalledPluginVersion,
  updatePluginVersion,
  getPluginMigrationHistory,
} from "@betagors/yama-core";
import semver from "semver";

interface PluginRollbackOptions {
  toVersion?: string;
  steps?: number;
  dryRun?: boolean;
  config?: string;
  env?: string;
  force?: boolean;
  skipConfirm?: boolean;
}

/**
 * Calculate target version based on steps
 */
function calculateTargetVersion(
  installedVersion: string,
  steps: number,
  migrationHistory: Array<{ version: string; migration_name: string; applied_at: Date }>
): string {
  // Sort migrations by version (descending)
  const sortedMigrations = [...migrationHistory].sort((a, b) => {
    if (semver.valid(a.version) && semver.valid(b.version)) {
      return semver.rcompare(a.version, b.version);
    }
    return b.version.localeCompare(a.version);
  });

  // Get the version at the specified step
  if (steps >= sortedMigrations.length) {
    return sortedMigrations[sortedMigrations.length - 1]?.version || "0.0.0";
  }

  return sortedMigrations[steps - 1]?.version || installedVersion;
}

/**
 * Get migrations that will be rolled back
 */
function getMigrationsToRollback(
  installedVersion: string,
  targetVersion: string,
  migrationHistory: Array<{ version: string; migration_name: string; applied_at: Date }>
): Array<{ version: string; migration_name: string; applied_at: Date }> {
  return migrationHistory.filter((m) => {
    if (semver.valid(m.version) && semver.valid(targetVersion)) {
      return semver.gt(m.version, targetVersion) && semver.lte(m.version, installedVersion);
    }
    // Fallback to string comparison
    return m.version > targetVersion && m.version <= installedVersion;
  }).sort((a, b) => {
    // Sort descending (newest first) for rollback order
    if (semver.valid(a.version) && semver.valid(b.version)) {
      return semver.rcompare(a.version, b.version);
    }
    return b.version.localeCompare(a.version);
  });
}

export async function pluginRollbackCommand(
  pluginName: string,
  options: PluginRollbackOptions
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
      warning("⚠️  WARNING: You are about to rollback migrations in PRODUCTION!");
      warning("   This operation can cause data loss and service disruption.");
      warning("   Consider taking a database backup first.");
      console.log();
      
      if (!options.skipConfirm) {
        const confirmed = await confirm(
          "Are you absolutely sure you want to continue?",
          false
        );
        if (!confirmed) {
          info("Rollback cancelled.");
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
        `No database plugin found. Plugin rollback requires a database plugin.`
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

    // Load plugin
    const plugin = await loadPlugin(pluginName, configDir);
    const manifest = plugin.manifest;

    if (!manifest || !manifest.migrations) {
      error(`Plugin ${pluginName} has no migrations defined`);
      await dbPlugin.client.closeDatabase();
      process.exit(1);
    }

    // Get current installed version
    const installedVersion = await getInstalledPluginVersion(pluginName, sql);

    if (!installedVersion) {
      error(`Plugin ${pluginName} is not installed or has no version record`);
      await dbPlugin.client.closeDatabase();
      process.exit(1);
    }

    // Get migration history
    const migrationHistory = await getPluginMigrationHistory(pluginName, sql);

    // Determine target version
    let toVersion: string;
    if (options.steps) {
      if (options.steps < 1) {
        error("Steps must be a positive number");
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
      toVersion = calculateTargetVersion(installedVersion, options.steps, migrationHistory);
      if (!toVersion || toVersion === installedVersion) {
        info(`Plugin ${pluginName} is already at the target version (${installedVersion})`);
        await dbPlugin.client.closeDatabase();
        return;
      }
    } else if (options.toVersion) {
      toVersion = options.toVersion;
    } else {
      error("Either --to-version or --steps must be specified");
      await dbPlugin.client.closeDatabase();
      process.exit(1);
    }

    // Validate version
    if (toVersion === installedVersion) {
      info(`Plugin ${pluginName} is already at version ${toVersion}`);
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Validate version format
    if (semver.valid(toVersion) && semver.valid(installedVersion)) {
      if (semver.gt(toVersion, installedVersion)) {
        error(`Target version ${toVersion} is newer than installed version ${installedVersion}. Use 'yama plugin migrate' to upgrade.`);
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
    }

    // Get migrations that will be rolled back
    const migrationsToRollback = getMigrationsToRollback(
      installedVersion,
      toVersion,
      migrationHistory
    );

    if (migrationsToRollback.length === 0) {
      info(`No migrations to rollback. Plugin ${pluginName} is already at or before version ${toVersion}`);
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Show detailed rollback plan
    console.log("\n" + "=".repeat(60));
    printBox(
      `Rollback Plan: ${pluginName}\n\n` +
      `Current Version: ${installedVersion}\n` +
      `Target Version: ${toVersion}\n` +
      `Migrations to Rollback: ${migrationsToRollback.length}`,
      isProduction ? { borderColor: "red" } : undefined
    );

    // Show migration details
    const rollbackTable: string[][] = [
      ["#", "Version", "Migration Name", "Applied At"],
    ];
    
    migrationsToRollback.forEach((m, index) => {
      rollbackTable.push([
        `${index + 1}`,
        m.version,
        m.migration_name,
        new Date(m.applied_at).toLocaleString(),
      ]);
    });

    printTable(rollbackTable);

    // Check if any migrations lack rollback support
    const missingRollback: string[] = [];
    for (const m of migrationsToRollback) {
      const migrationDef = manifest.migrations?.[m.version];
      if (!migrationDef || !migrationDef.down) {
        missingRollback.push(`${m.version} (${m.migration_name})`);
      }
    }

    if (missingRollback.length > 0) {
      warning("\n⚠️  Warning: The following migrations do not have rollback scripts:");
      missingRollback.forEach((v) => warning(`   - ${v}`));
      warning("   These migrations cannot be safely rolled back.");
      
      if (!options.force && !options.dryRun) {
        const confirmed = await confirm(
          "Continue anyway? (This may leave your database in an inconsistent state)",
          false
        );
        if (!confirmed) {
          info("Rollback cancelled.");
          await dbPlugin.client.closeDatabase();
          return;
        }
      }
    }

    if (options.dryRun) {
      info("\n🔍 Dry run mode - no changes will be made");
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Confirm rollback (unless forced or in non-interactive mode)
    if (!options.skipConfirm && !options.force) {
      console.log("\n⚠️  Warning: Rollback will undo database changes!");
      const confirmed = await confirm(
        `Rollback ${pluginName} from ${installedVersion} to ${toVersion}?`,
        false
      );
      if (!confirmed) {
        info("Rollback cancelled.");
        await dbPlugin.client.closeDatabase();
        return;
      }
    }

    // Get plugin directory
    const pluginDir = await getPluginPackageDir(pluginName, configDir);

    try {
      // Execute rollback
      await rollbackPluginMigration(
        pluginName,
        toVersion,
        sql,
        pluginDir,
        manifest
      );

      // Update version record
      await updatePluginVersion(pluginName, toVersion, sql);

      success(`\n✅ Successfully rolled back ${pluginName} from ${installedVersion} to ${toVersion}`);
      info(`   Rolled back ${migrationsToRollback.length} migration(s)`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      error(`\n❌ Rollback failed: ${errorMsg}`);
      error("\n💡 Tips:");
      error("   - Check the error message above for details");
      error("   - Verify your database connection");
      error("   - Ensure rollback scripts are valid");
      error("   - Consider restoring from a backup if needed");
      await dbPlugin.client.closeDatabase();
      process.exit(1);
    } finally {
      // Close database connection
      await dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to rollback plugin: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

