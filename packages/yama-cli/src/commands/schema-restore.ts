import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.js";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.js";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import type { DatabaseConfig } from "@yama/core";
import { restoreFromSnapshot, listSnapshots, deleteSnapshot } from "@yama/db-postgres";
import { success, error, info, printTable } from "../utils/cli-utils.js";
import { confirm } from "../utils/interactive.js";

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
    loadEnvFile(configPath);
    let config = readYamaConfig(configPath) as { database?: DatabaseConfig };
    config = resolveEnvVars(config) as { database?: DatabaseConfig };

    if (!config.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    if (options.list) {
      // List available snapshots
      const snapshots = await listSnapshots(config.database);

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

      await restoreFromSnapshot(options.snapshot, options.table, config.database);
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

