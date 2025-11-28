import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig, resolveEnvVars, loadEnvFile } from "../utils/file-utils.ts";
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
      process.exit(1);
    }

    // Get current installed version
    const installedVersion = await getInstalledPluginVersion(pluginName, sql);

    if (!installedVersion) {
      error(`Plugin ${pluginName} is not installed or has no version record`);
      process.exit(1);
    }

    const toVersion = options.toVersion;

    // Validate version
    if (toVersion === installedVersion) {
      info(`Plugin ${pluginName} is already at version ${toVersion}`);
      return;
    }

    // Show rollback plan
    console.log(`\nPlugin: ${pluginName}`);
    console.log(`Current version: ${installedVersion}`);
    console.log(`Target version: ${toVersion}`);
    console.log(`\nThis will rollback migrations from ${installedVersion} to ${toVersion}`);

    if (options.dryRun) {
      info("\n🔍 Dry run mode - no changes will be made");
      return;
    }

    // Confirm rollback
    console.log("\n⚠️  Warning: Rollback will undo database changes!");
    // In a real CLI, you might want to add a confirmation prompt here

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

      success(`Rolled back ${pluginName} to version ${toVersion}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      error(`Rollback failed: ${errorMsg}`);
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

