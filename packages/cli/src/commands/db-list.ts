import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import type { DatabaseConfig } from "@yama/core";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { success, error, info, printTable, colors } from "../utils/cli-utils.ts";

interface DbListOptions {
  config?: string;
  env?: string;
}

export async function dbListCommand(options: DbListOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as { database?: DatabaseConfig };
    config = resolveEnvVars(config) as { database?: DatabaseConfig };

    if (!config.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    // Initialize database
    const dbPlugin = await getDatabasePlugin();
    await dbPlugin.client.initDatabase(config.database);
    const sql = dbPlugin.client.getSQL();

    try {
      // Get all user tables (excluding system tables, migration tables, and snapshot tables)
      const tablesResult = await sql.unsafe(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT LIKE '_yama_%'
          AND table_name NOT LIKE '%_before_%'
          AND table_name NOT LIKE '%_snapshot_%'
        ORDER BY table_name
      `);

      if (tablesResult.length === 0) {
        info("No tables found in database.");
        await dbPlugin.client.closeDatabase();
        return;
      }

      // Get row counts for each table
      const tableData: unknown[][] = [["Table Name", "Row Count"]];
      
      for (const row of tablesResult as Array<{ table_name: string }>) {
        const tableName = row.table_name;
        try {
          // Quote table name for safe identifier usage (escape any quotes in the name)
          const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;
          const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM ${quotedTableName}`);
          const countValue = (countResult[0] as { count: bigint | number | string }).count;
          // Handle bigint properly
          const rowCount = typeof countValue === 'bigint' 
            ? Number(countValue) 
            : typeof countValue === 'string' 
            ? parseInt(countValue, 10) 
            : countValue;
          tableData.push([
            tableName,
            isFinite(rowCount) ? rowCount.toLocaleString() : String(countValue),
          ]);
        } catch (err) {
          // If we can't count rows, still show the table but with error
          tableData.push([
            tableName,
            colors.error("Error"),
          ]);
        }
      }

      // Show database type/location if available
      const dbType = config.database.dialect === "pglite" ? "PGLite" : "PostgreSQL";
      const dbLocation = config.database.url 
        ? (config.database.url === ":memory:" || config.database.url === "pglite" 
            ? "in-memory" 
            : config.database.url)
        : "default";

      console.log(`\n📊 Database Tables (${dbType} - ${dbLocation}):\n`);
      printTable(tableData);

      success(`\nFound ${tablesResult.length} table(s).`);
    } finally {
      await dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to list database tables: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

