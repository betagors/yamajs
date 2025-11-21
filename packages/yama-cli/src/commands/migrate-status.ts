import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { getConfigDir } from "../utils/file-utils.js";
import { findYamaConfig } from "../utils/project-detection.js";
import { initDatabase, getSQL, closeDatabase } from "@yama/db-postgres";
import type { DatabaseConfig } from "@yama/core";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import { readYamaConfig } from "../utils/file-utils.js";

interface MigrateStatusOptions {
  config?: string;
}

export async function migrateStatusCommand(options: MigrateStatusOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    // Load .env file
    loadEnvFile(configPath);
    
    let config = readYamaConfig(configPath) as { database?: DatabaseConfig };
    config = resolveEnvVars(config) as { database?: DatabaseConfig };
    const configDir = getConfigDir(configPath);

    if (!config.database) {
      console.error("❌ No database configuration found in yama.yaml");
      process.exit(1);
    }

    // Initialize database connection
    initDatabase(config.database);
    const sql = getSQL();

    const migrationsDir = join(configDir, "migrations");

    if (!existsSync(migrationsDir)) {
      console.log("ℹ️  No migrations directory found.");
      await closeDatabase();
      return;
    }

    // Get all migration files
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    if (migrationFiles.length === 0) {
      console.log("ℹ️  No migration files found.");
      await closeDatabase();
      return;
    }

    // Get applied migrations
    let appliedMigrations: { name: string; applied_at: Date }[] = [];
    try {
      const result = await sql`
        SELECT name, applied_at FROM _yama_migrations ORDER BY applied_at
      `;
      appliedMigrations = result as unknown as Array<{ name: string; applied_at: Date }>;
    } catch {
      // Migrations table doesn't exist yet
    }

    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    console.log("📊 Migration Status:\n");

    let pendingCount = 0;
    for (const file of migrationFiles) {
      const isApplied = appliedNames.has(file);
      const status = isApplied ? "✅ Applied" : "⏳ Pending";
      const appliedAt = isApplied
        ? appliedMigrations.find(m => m.name === file)?.applied_at.toISOString()
        : "";

      console.log(`${status}  ${file}${appliedAt ? ` (${appliedAt})` : ""}`);
      if (!isApplied) {
        pendingCount++;
      }
    }

    if (pendingCount === 0) {
      console.log("\n✅ All migrations are applied.");
    } else {
      console.log(`\n⏳ ${pendingCount} migration(s) pending. Apply with: yama db:migrate:apply`);
    }

    await closeDatabase();
  } catch (error) {
    console.error("❌ Failed to check migration status:", error instanceof Error ? error.message : String(error));
    await closeDatabase();
    process.exit(1);
  }
}

