import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import type { DatabaseConfig } from "@betagors/yama-core";
import { getDatabasePlugin } from "../../utils/db-plugin.ts";
import { getMCPWorkingDir } from "../utils/workdir.ts";

export async function getMigrationStatusResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const workDir = getMCPWorkingDir();
  const originalCwd = process.cwd();
  
  try {
    if (workDir !== originalCwd) {
      process.chdir(workDir);
    }
    
    const configPath = findYamaConfig(workDir) || resolve(workDir, "yama.yaml");

    if (!existsSync(configPath)) {
      throw new Error(
        `Config file not found: ${configPath}\n` +
        `Working directory: ${workDir}\n` +
        `Tip: Set YAMA_MCP_WORKDIR environment variable to point to your YAMA project directory in a monorepo.`
      );
    }

    try {
      const environment = process.env.NODE_ENV || "development";
      loadEnvFile(configPath, environment);
      let config = readYamaConfig(configPath) as { database?: DatabaseConfig };
      config = resolveEnvVars(config) as { database?: DatabaseConfig };
      const configDir = getConfigDir(configPath);

      if (!config.database) {
        return {
          contents: [
            {
              uri: "yama://migration-status",
              mimeType: "application/json",
              text: JSON.stringify({ error: "No database configuration found" }, null, 2),
            },
          ],
        };
      }

      const migrationsDir = join(configDir, "migrations");

      if (!existsSync(migrationsDir)) {
        return {
          contents: [
            {
              uri: "yama://migration-status",
              mimeType: "application/json",
              text: JSON.stringify({ migrations: [], applied: [], pending: [] }, null, 2),
            },
          ],
        };
      }

      // Get all migration files
      const migrationFiles = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".sql"))
        .map((f) => {
          const match = f.match(/^(\d{14})_(.+)\.(yaml|sql)$/);
          if (match) {
            return { timestamp: match[1], name: match[2], file: f };
          }
          return null;
        })
        .filter((f): f is { timestamp: string; name: string; file: string } => f !== null)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Remove duplicates
      const uniqueMigrations = new Map<string, { timestamp: string; name: string; file: string }>();
      for (const migration of migrationFiles) {
        if (!uniqueMigrations.has(migration.timestamp) || migration.file.endsWith(".yaml")) {
          uniqueMigrations.set(migration.timestamp, migration);
        }
      }
      const sortedMigrations = Array.from(uniqueMigrations.values()).sort(
        (a, b) => a.timestamp.localeCompare(b.timestamp)
      );

      // Initialize database and get applied migrations
      const dbPlugin = await getDatabasePlugin();
      await dbPlugin.client.initDatabase(config.database);
      const sql = dbPlugin.client.getSQL();

      // Create migration tables if they don't exist
      await sql.unsafe(dbPlugin.migrations.getMigrationTableSQL());
      await sql.unsafe(dbPlugin.migrations.getMigrationRunsTableSQL());

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
        // Table doesn't exist yet
      }

      const appliedNames = new Set(appliedMigrations.map((m) => m.name));
      const applied = sortedMigrations.filter((m) => appliedNames.has(m.file));
      const pending = sortedMigrations.filter((m) => !appliedNames.has(m.file));

      await dbPlugin.client.closeDatabase();

      const status = {
        total: sortedMigrations.length,
        applied: applied.length,
        pending: pending.length,
        migrations: sortedMigrations.map((m) => ({
          file: m.file,
          name: m.name,
          timestamp: m.timestamp,
          status: appliedNames.has(m.file) ? "applied" : "pending",
          appliedAt: appliedMigrations.find((a) => a.name === m.name)?.applied_at?.toISOString(),
        })),
      };

      return {
        contents: [
          {
            uri: "yama://migration-status",
            mimeType: "application/json",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: "yama://migration-status",
            mimeType: "application/json",
            text: JSON.stringify(
              { error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  } finally {
    if (workDir !== originalCwd) {
      process.chdir(originalCwd);
    }
  }
}




