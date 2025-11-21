import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.js";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.js";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import type { DatabaseConfig } from "@yama/core";
import { initDatabase, getSQL, closeDatabase } from "@yama/db-postgres";
import { success, error, info, printTable, colors } from "../utils/cli-utils.js";

interface SchemaHistoryOptions {
  config?: string;
  graph?: boolean;
  env?: string;
}

export async function schemaHistoryCommand(options: SchemaHistoryOptions): Promise<void> {
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

    initDatabase(config.database);
    const sql = getSQL();

    // Get migration history
    let migrations: Array<{
      id: number;
      name: string;
      type: string;
      from_model_hash: string;
      to_model_hash: string;
      description: string | null;
      applied_at: Date;
    }> = [];

    try {
      const result = await sql`
        SELECT id, name, type, from_model_hash, to_model_hash, description, applied_at
        FROM _yama_migrations
        ORDER BY applied_at DESC
      `;
      migrations = result as unknown as typeof migrations;
    } catch {
      info("No migration history found.");
      await closeDatabase();
      return;
    }

    if (migrations.length === 0) {
      info("No migrations in history.");
      await closeDatabase();
      return;
    }

    if (options.graph) {
      // Simple timeline visualization
      console.log("\n📅 Migration Timeline:\n");
      migrations.forEach((m, index) => {
        const arrow = index < migrations.length - 1 ? "↓" : "";
        console.log(
          `${colors.dim(m.applied_at.toISOString().split("T")[0])} ${m.name} ${arrow}`
        );
        if (m.description) {
          console.log(colors.dim(`   ${m.description}`));
        }
      });
    } else {
      // Table view
      const tableData: unknown[][] = [
        ["ID", "Name", "From Hash", "To Hash", "Applied At"],
      ];

      for (const m of migrations) {
        tableData.push([
          m.id,
          m.name,
          m.from_model_hash ? m.from_model_hash.substring(0, 8) + "..." : "-",
          m.to_model_hash ? m.to_model_hash.substring(0, 8) + "..." : "-",
          m.applied_at.toISOString().split("T")[0],
        ]);
      }

      console.log("\n📜 Migration History:\n");
      printTable(tableData);
    }

    await closeDatabase();
  } catch (err) {
    error(`Failed to get migration history: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

