import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import type { DatabaseConfig } from "@betagors/yama-core";
import { getDatabasePluginAndConfig } from "../utils/db-plugin.ts";
import { success, error, info, printTable } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";

interface SchemaRestoreOptions {
  config?: string;
  snapshot?: string;
  table?: string;
  list?: boolean;
}

export async function schemaRestoreCommand(options: SchemaRestoreOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;

    // Get database plugin and config (builds from plugin config if needed)
    const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
    
    if (options.list) {
      // List available snapshots
      const snapshots = await dbPlugin.snapshots.list(dbConfig);

      if (snapshots.length === 0) {
        info("No snapshots found");
        return;
      }

      const tableData: unknown[][] = [
        ["Snapshot Table", "Created", "Row Count"],
      ];

      for (const snapshot of snapshots) {
        tableData.push([
          snapshot.table_name,
          snapshot.created_at,
          snapshot.row_count.toLocaleString(),
        ]);
      }

      console.log("\n📸 Available Snapshots:\n");
      printTable(tableData);
    } else if (options.snapshot && options.table) {
      // Restore from snapshot
      const confirmed = await confirm(
        `Restore table ${options.table} from snapshot ${options.snapshot}? This will replace all current data.`,
        false
      );

      if (!confirmed) {
        info("Restore cancelled");
        return;
      }

      await dbPlugin.snapshots.restore(options.snapshot, options.table, dbConfig);
      success(`Restored ${options.table} from snapshot ${options.snapshot}`);
    } else {
      error("Usage: yama schema:restore --list");
      error("       yama schema:restore --snapshot <name> --table <table>");
      process.exit(1);
    }
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

