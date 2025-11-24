import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import type { DatabaseConfig } from "@yama/core";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { success, error, info, printTable, colors } from "../utils/cli-utils.ts";

interface SchemaStatusOptions {
  config?: string;
  short?: boolean;
  env?: string;
}

export async function schemaStatusCommand(options: SchemaStatusOptions): Promise<void> {
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
    const configDir = getConfigDir(configPath);

    if (!config.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    const migrationsDir = join(configDir, "migrations");

    if (!existsSync(migrationsDir)) {
      info("No migrations directory found.");
      return;
    }

    // Get all migration files
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".sql"))
      .map((f) => {
        // Extract timestamp and name (format: YYYYMMDDHHmmss_name.yaml)
        const match = f.match(/^(\d{14})_(.+)\.(yaml|sql)$/);
        if (match) {
          return { timestamp: match[1], name: match[2], file: f };
        }
        return null;
      })
      .filter((f): f is { timestamp: string; name: string; file: string } => f !== null)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Remove duplicates (keep YAML files, ignore SQL files if YAML exists)
    const uniqueMigrations = new Map<string, { timestamp: string; name: string; file: string }>();
    for (const migration of migrationFiles) {
      if (!uniqueMigrations.has(migration.timestamp) || migration.file.endsWith(".yaml")) {
        uniqueMigrations.set(migration.timestamp, migration);
      }
    }
    const sortedMigrations = Array.from(uniqueMigrations.values()).sort(
      (a, b) => a.timestamp.localeCompare(b.timestamp)
    );

    if (sortedMigrations.length === 0) {
      info("No migration files found.");
      return;
    }

    // Initialize database
    const dbPlugin = await getDatabasePlugin();
    await dbPlugin.client.initDatabase(config.database);
    const sql = dbPlugin.client.getSQL();

    // Create migration tables if they don't exist
    await sql.unsafe(dbPlugin.migrations.getMigrationTableSQL());
    await sql.unsafe(dbPlugin.migrations.getMigrationRunsTableSQL());

    // Get applied migrations
    let appliedMigrations: Array<{
      name: string;
      applied_at: Date;
      to_model_hash?: string;
    }> = [];
    try {
      const result = await sql.unsafe(`
        SELECT name, applied_at, to_model_hash
        FROM _yama_migrations
        ORDER BY applied_at
      `);
      appliedMigrations = result as unknown as typeof appliedMigrations;
    } catch {
      // Table doesn't exist yet (shouldn't happen after creating it, but handle gracefully)
    }

    const appliedNames = new Set(appliedMigrations.map((m) => m.name));
    const appliedMap = new Map(
      appliedMigrations.map((m) => [m.name, m])
    );

    if (options.short) {
      const pendingCount = sortedMigrations.filter(
        (m) => !appliedNames.has(m.file)
      ).length;
      const appliedCount = sortedMigrations.filter((m) => appliedNames.has(m.file)).length;

      console.log(`${pendingCount} pending, ${appliedCount} applied`);
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Build status table
    const tableData: unknown[][] = [["Status", "Migration", "Applied At", "Hash"]];

    let pendingCount = 0;
    for (const migration of sortedMigrations) {
      const isApplied = appliedNames.has(migration.file);
      const applied = appliedMap.get(migration.file);

      const status = isApplied
        ? colors.success("✅ Applied")
        : colors.warning("⏳ Pending");
      const appliedAt = applied
        ? new Date(applied.applied_at).toISOString().split("T")[0]
        : "-";
      const hash = applied?.to_model_hash
        ? applied.to_model_hash.substring(0, 8) + "..."
        : "-";

      tableData.push([
        status,
        migration.file,
        appliedAt,
        hash,
      ]);

      if (!isApplied) {
        pendingCount++;
      }
    }

    console.log("\n📊 Migration Status:\n");
    printTable(tableData);

    if (pendingCount === 0) {
      success("\nAll migrations are applied.");
    } else {
      info(`\n${pendingCount} migration(s) pending. Apply with: yama schema:apply`);
    }

    await dbPlugin.client.closeDatabase();
  } catch (err) {
    error(`Failed to check migration status: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

