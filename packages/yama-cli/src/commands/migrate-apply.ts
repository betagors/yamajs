import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getConfigDir } from "../utils/file-utils.js";
import { findYamaConfig } from "../utils/project-detection.js";
import { initDatabase, getSQL, closeDatabase } from "@yama/db-postgres";
import type { DatabaseConfig } from "@yama/core";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import { readYamaConfig } from "../utils/file-utils.js";

interface MigrateApplyOptions {
  config?: string;
}

export async function migrateApplyCommand(options: MigrateApplyOptions): Promise<void> {
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
      console.log("ℹ️  No migrations directory found. Run 'yama db:migrate' first.");
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

    // Create migrations table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS _yama_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Get applied migrations
    const appliedMigrations = await sql`
      SELECT name FROM _yama_migrations ORDER BY applied_at
    `;
    const appliedNames = new Set((appliedMigrations as unknown as Array<{ name: string }>).map((m) => m.name));

    // Apply pending migrations
    let appliedCount = 0;
    for (const file of migrationFiles) {
      if (appliedNames.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      const filePath = join(migrationsDir, file);
      const sqlContent = readFileSync(filePath, "utf-8");

      console.log(`📝 Applying ${file}...`);

      try {
        // Execute migration SQL
        await sql.unsafe(sqlContent);

        // Record migration
        await sql`
          INSERT INTO _yama_migrations (name) VALUES (${file})
        `;

        console.log(`✅ Applied ${file}`);
        appliedCount++;
      } catch (error) {
        console.error(`❌ Failed to apply ${file}:`, error instanceof Error ? error.message : String(error));
        await closeDatabase();
        process.exit(1);
      }
    }

    if (appliedCount === 0) {
      console.log("ℹ️  All migrations are already applied.");
    } else {
      console.log(`\n✅ Applied ${appliedCount} migration(s)`);
    }

    await closeDatabase();
  } catch (error) {
    console.error("❌ Failed to apply migrations:", error instanceof Error ? error.message : String(error));
    await closeDatabase();
    process.exit(1);
  }
}

