import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { resolveEnvVars, loadEnvFile } from "@betagors/yama-core";
import { success, error, info, warning } from "../utils/cli-utils.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { loadPlugin, getAllPlugins } from "@betagors/yama-core";
import {
  ensurePluginMigrationTables,
  getPluginMigrationHistory,
} from "@betagors/yama-core";
import {
  getPluginMigrationStatus,
} from "@betagors/yama-core";
import { table } from "table";

interface PluginStatusOptions {
  plugin?: string;
  config?: string;
  env?: string;
}

export async function pluginStatusCommand(
  options: PluginStatusOptions
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

    // Get database plugin (optional for status - we'll handle gracefully if not available)
    let dbPlugin;
    let sql: any = null;
    try {
      dbPlugin = await getDatabasePlugin(config.plugins, configPath);
      if (config.database) {
        await dbPlugin.client.initDatabase(config.database);
        sql = dbPlugin.client.getSQL();
        await ensurePluginMigrationTables(sql);
      }
    } catch (err) {
      warning("No database plugin available - showing plugin info only");
    }

    // Get plugins to show status for
    const pluginsToShow: string[] = [];
    if (options.plugin) {
      pluginsToShow.push(options.plugin);
    } else {
      // Get all plugins from config
      if (config.plugins) {
        const pluginList = Array.isArray(config.plugins)
          ? config.plugins
          : Object.keys(config.plugins);
        pluginsToShow.push(...pluginList);
      }
    }

    if (pluginsToShow.length === 0) {
      info("No plugins configured");
      return;
    }

    const statusRows: string[][] = [["Plugin", "Installed", "Package", "Pending", "Status"]];

    for (const pluginName of pluginsToShow) {
      try {
        // Load plugin
        const plugin = await loadPlugin(pluginName, configDir);
        const manifest = plugin.manifest;

        let installedVersion = "N/A";
        let pendingMigrations = 0;
        let status = "✅ Up to date";

        if (sql && manifest?.migrations) {
          const statusInfo = await getPluginMigrationStatus(
            pluginName,
            plugin,
            manifest,
            sql
          );
          installedVersion = statusInfo.installedVersion || "Not installed";
          pendingMigrations = statusInfo.pendingMigrations;

          if (pendingMigrations > 0) {
            status = `⚠️  ${pendingMigrations} pending`;
          } else if (installedVersion === "Not installed") {
            status = "📦 Not migrated";
          }
        }

        const packageVersion = plugin.version || "Unknown";

        statusRows.push([
          pluginName,
          installedVersion,
          packageVersion,
          pendingMigrations > 0 ? String(pendingMigrations) : "0",
          status,
        ]);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("Cannot find module") || errorMsg.includes("not found")) {
          statusRows.push([
            pluginName,
            "N/A",
            "N/A",
            "N/A",
            "❌ Not installed",
          ]);
        } else {
          statusRows.push([
            pluginName,
            "N/A",
            "N/A",
            "N/A",
            `❌ Error: ${errorMsg}`,
          ]);
        }
      }
    }

    // Display status table
    console.log("\n📦 Plugin Migration Status\n");
    console.log(table(statusRows));

    // Show migration history for specific plugin if requested
    if (options.plugin && sql) {
      try {
        const plugin = await loadPlugin(options.plugin, configDir);
        const history = await getPluginMigrationHistory(options.plugin, sql);

        if (history.length > 0) {
          console.log(`\n📜 Migration History for ${options.plugin}\n`);
          const historyRows: string[][] = [
            ["Version", "Migration", "Type", "Applied At"],
          ];
          for (const h of history) {
            historyRows.push([
              h.version,
              h.migration_name,
              h.type,
              new Date(h.applied_at).toLocaleString(),
            ]);
          }
          console.log(table(historyRows));
        } else {
          info(`No migration history for ${options.plugin}`);
        }
      } catch (err) {
        // Ignore errors for history
      }
    }

    // Close database connection if opened
    if (dbPlugin && config.database) {
      await dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to get plugin status: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}


