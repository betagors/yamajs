import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import type { DatabaseConfig } from "@betagors/yama-core";
import { getDatabasePluginAndConfig } from "../utils/db-plugin.ts";
import { success, error, info, printTable, colors } from "../utils/cli-utils.ts";

interface DbInspectOptions {
  config?: string;
  env?: string;
}

export async function dbInspectCommand(
  tableName: string,
  options: DbInspectOptions
): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  if (!tableName) {
    error("Table name is required");
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;

    // Get database plugin and config (builds from plugin config if needed)
    const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
    await dbPlugin.client.initDatabase(dbConfig);
    const sql = dbPlugin.client.getSQL();

    try {
      // Check if table exists
      // Note: tableName comes from information_schema, so it's safe to use in WHERE clause
      const tableExistsResult = await sql.unsafe(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = '${tableName.replace(/'/g, "''")}'
      `);

      if (tableExistsResult.length === 0) {
        error(`Table '${tableName}' does not exist in the database.`);
        info(`Use 'yama db list' to see available tables.`);
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }

      // Quote table name for safe identifier usage in FROM clauses
      const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;

      // Get column information
      // Note: tableName comes from information_schema, so it's safe to use in WHERE clause
      const escapedTableName = tableName.replace(/'/g, "''");
      const columnsResult = await sql.unsafe(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          is_identity
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${escapedTableName}'
        ORDER BY ordinal_position
      `);

      // Get primary key
      const pkResult = await sql.unsafe(`
        SELECT column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = '${escapedTableName}'
          AND tc.constraint_type = 'PRIMARY KEY'
      `);

      const primaryKeyColumns = new Set(
        (pkResult as Array<{ column_name: string }>).map((r) => r.column_name)
      );

      // Get row count
      const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM ${quotedTableName}`);
      const countValue = (countResult[0] as { count: bigint | number | string }).count;
      // Handle bigint properly
      const rowCount = typeof countValue === 'bigint' 
        ? Number(countValue) 
        : typeof countValue === 'string' 
        ? parseInt(countValue, 10) 
        : countValue;

      // Display schema information
      console.log(`\n📋 Table: ${colors.bold(tableName)}\n`);

      // Column schema table
      const schemaData: unknown[][] = [["Column", "Type", "Nullable", "Default", "PK"]];
      
      for (const col of columnsResult as Array<{
        column_name: string;
        data_type: string;
        character_maximum_length: number | null;
        is_nullable: string;
        column_default: string | null;
        is_identity: string;
      }>) {
        // Format data type
        let typeStr = col.data_type.toUpperCase();
        if (col.character_maximum_length) {
          typeStr += `(${col.character_maximum_length})`;
        }

        // Format default value
        let defaultStr = col.column_default || "-";
        if (defaultStr !== "-" && defaultStr.length > 30) {
          defaultStr = defaultStr.substring(0, 27) + "...";
        }

        const isPK = primaryKeyColumns.has(col.column_name);
        const isNullable = col.is_nullable === "YES";

        schemaData.push([
          col.column_name,
          typeStr,
          isNullable ? "Yes" : colors.dim("No"),
          defaultStr,
          isPK ? colors.success("✓") : "-",
        ]);
      }


      // Fallback to text output
      console.log("📐 Schema:\n");
      printTable(schemaData);
      console.log(`\n📊 Total rows: ${colors.bold(rowCount.toLocaleString())}\n`);

      if (sampleData) {
        // Get column names from first row
        const columnNames = Object.keys(sampleData[0]);
        
        // Build sample data table
        const sampleTableData: unknown[][] = [columnNames];
        
        for (const row of sampleData) {
          const rowData: unknown[] = [];
          for (const colName of columnNames) {
            const value = row[colName];
            if (value === null) {
              rowData.push(colors.dim("NULL"));
            } else if (typeof value === "string" && value.length > 30) {
              rowData.push(value.substring(0, 27) + "...");
            } else {
              rowData.push(String(value));
            }
          }
          sampleTableData.push(rowData);
        }

        console.log("📄 Sample Data (first 10 rows):\n");
        printTable(sampleTableData);
        
        if (rowCount > 10) {
          info(`\nShowing 10 of ${rowCount.toLocaleString()} rows.`);
        }
      } else {
        info("Table is empty (no rows).");
      }

      success("\nInspection complete.");
    } finally {
      await dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to inspect table: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

