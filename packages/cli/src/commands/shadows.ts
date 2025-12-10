import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  getActiveShadowColumns,
  getExpiredShadowColumns,
  getShadowColumnsForTable,
  markShadowRestored,
  deleteShadowColumn,
  loadShadowManifest,
  loadEnvFile,
  resolveEnvVars,
} from "@betagors/yama-core";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { table } from "table";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { confirm } from "../utils/interactive.ts";

interface ShadowsListOptions {
  config?: string;
  table?: string;
  expired?: boolean;
}

interface ShadowsRestoreOptions {
  config?: string;
  table: string;
  column: string;
}

interface ShadowsCleanupOptions {
  config?: string;
  expired?: boolean;
  before?: string;
}

export async function shadowsListCommand(options: ShadowsListOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const manifest = loadShadowManifest(configDir);
    
    let shadows = options.expired
      ? getExpiredShadowColumns(configDir)
      : getActiveShadowColumns(configDir);

    if (options.table) {
      shadows = shadows.filter(s => s.table === options.table);
    }

    if (shadows.length === 0) {
      info("No shadow columns found.");
      return;
    }

    const tableData = [
      ["Table", "Column", "Original", "Snapshot", "Rows", "Size", "Expires", "Status"],
      ...shadows.map(s => [
        s.table,
        s.column,
        s.originalName,
        s.snapshot.substring(0, 8),
        s.rowCount?.toString() || "N/A",
        s.size || "N/A",
        new Date(s.expiresAt).toLocaleDateString(),
        s.status,
      ]),
    ];

    console.log("\n" + table(tableData));
  } catch (err) {
    error(`Failed to list shadows: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export async function shadowsRestoreCommand(options: ShadowsRestoreOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const shadow = getShadowColumnsForTable(configDir, options.table)
      .find(s => s.column === options.column);

    if (!shadow) {
      error(`Shadow column not found: ${options.table}.${options.column}`);
      process.exit(1);
    }

    info(`Restoring ${options.table}.${shadow.originalName}...`);
    warning("This will rename the shadow column back to its original name.");
    warning("Make sure to update yama.yaml to include this field.");

    const confirmed = await confirm("Continue with restoration?", false);
    if (!confirmed) {
      info("Restoration cancelled.");
      return;
    }

    // Get database connection
    loadEnvFile(configPath);
    const config = readYamaConfig(configPath) as any;
    const resolvedConfig = resolveEnvVars(config) as any;
    
    if (!resolvedConfig.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    const dbPlugin = await getDatabasePlugin(resolvedConfig.plugins, configPath);
    await dbPlugin.client.initDatabase(resolvedConfig.database);
    const sql = dbPlugin.client.getSQL();

    try {
      // Rename shadow column back to original name
      await sql.unsafe(`
        ALTER TABLE ${shadow.table} 
        RENAME COLUMN ${shadow.column} TO ${shadow.originalName};
      `);
      
      markShadowRestored(configDir, options.table, options.column);
      success(`Shadow column restored: ${options.table}.${shadow.originalName}`);
    } finally {
      dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to restore shadow: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export async function shadowsCleanupCommand(options: ShadowsCleanupOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const expired = getExpiredShadowColumns(configDir);
    
    if (expired.length === 0) {
      info("No expired shadow columns to clean up.");
      return;
    }

    info(`Found ${expired.length} expired shadow column(s).`);
    
    const confirmed = await confirm("This will permanently delete expired shadow columns. Continue?", false);
    if (!confirmed) {
      info("Cleanup cancelled.");
      return;
    }

    // Get database connection
    loadEnvFile(configPath);
    const config = readYamaConfig(configPath) as any;
    const resolvedConfig = resolveEnvVars(config) as any;
    
    if (!resolvedConfig.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    const dbPlugin = await getDatabasePlugin(resolvedConfig.plugins, configPath);
    await dbPlugin.client.initDatabase(resolvedConfig.database);
    const sql = dbPlugin.client.getSQL();

    try {
      for (const shadow of expired) {
        // Drop the shadow column from database
        await sql.unsafe(`
          ALTER TABLE ${shadow.table} 
          DROP COLUMN IF EXISTS ${shadow.column} CASCADE;
        `);
        
        deleteShadowColumn(configDir, shadow.table, shadow.column);
        info(`Cleaned up: ${shadow.table}.${shadow.column}`);
      }

      success(`Cleaned up ${expired.length} shadow column(s).`);
    } finally {
      dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to cleanup shadows: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
















