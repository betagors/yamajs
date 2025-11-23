import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.js";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.js";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import type { DatabaseConfig } from "@yama/core";
import {
  entitiesToModel,
  computeModelHash,
  computeDiff,
  diffToSteps,
  getCurrentModelHashFromDB,
} from "@yama/core";
import { getDatabasePlugin } from "../utils/db-plugin.js";
import { colors, success, error, printBox, printTable } from "../utils/cli-utils.js";
import type { YamaEntities } from "@yama/core";

interface SchemaCheckOptions {
  config?: string;
  diff?: boolean;
  ci?: boolean;
  env?: string;
}

export async function schemaCheckCommand(options: SchemaCheckOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      entities?: YamaEntities;
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;

    if (!config.entities || Object.keys(config.entities).length === 0) {
      if (options.ci) {
        process.exit(0);
      }
      console.log("ℹ️  No entities defined in yama.yaml");
      return;
    }

    // Compute target model from YAML
    const targetModel = entitiesToModel(config.entities);
    const targetHash = targetModel.hash;

    // Get current model hash from database
    let currentHash: string | null = null;
    if (config.database) {
      const dbPlugin = await getDatabasePlugin();
      dbPlugin.client.initDatabase(config.database);
      const sql = dbPlugin.client.getSQL();

      // Ensure migration tables exist
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS _yama_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          type VARCHAR(50) DEFAULT 'schema',
          from_model_hash VARCHAR(64),
          to_model_hash VARCHAR(64),
          checksum VARCHAR(64),
          description TEXT,
          applied_at TIMESTAMP DEFAULT NOW()
        );
      `);

      try {
        const result = await sql`
          SELECT to_model_hash 
          FROM _yama_migrations 
          WHERE to_model_hash IS NOT NULL 
          ORDER BY applied_at DESC 
          LIMIT 1
        `;
        if (result && (result as unknown as Array<{ to_model_hash: string }>).length > 0) {
          currentHash = (result as unknown as Array<{ to_model_hash: string }>)[0].to_model_hash;
        }
      } catch (err) {
        // Table might not exist or query failed
        currentHash = null;
      }

      dbPlugin.client.closeDatabase();
    }

    // If no current hash, assume empty database
    if (!currentHash) {
      if (options.ci) {
        // In CI, if no migrations applied, exit with error
        process.exit(1);
      }
      console.log(colors.warning("⚠️  No migrations applied yet. Database appears to be empty."));
      console.log(colors.info("💡 Run 'yama schema:generate' to create your first migration."));
      process.exit(1);
    }

    // Compare hashes
    if (currentHash === targetHash) {
      if (!options.ci) {
        success("Schema is in sync");
      }
      process.exit(0);
    }

    // Hashes don't match - there's drift
    if (options.ci) {
      // In CI mode, just exit with error code
      process.exit(1);
    }

    // Show diff
    error("Schema drift detected");

    // For now, we'll show a simple message
    // In a full implementation, we'd reconstruct the current model and show detailed diff
    console.log(colors.dim(`Current hash: ${currentHash.substring(0, 8)}...`));
    console.log(colors.dim(`Target hash:  ${targetHash.substring(0, 8)}...`));

    if (options.diff) {
      // TODO: Reconstruct current model from DB and show detailed diff
      console.log(colors.info("\n💡 Run 'yama schema:generate' to create a migration for these changes."));
    } else {
      console.log(colors.info("\n💡 Run 'yama schema:check --diff' to see detailed changes."));
      console.log(colors.info("💡 Run 'yama schema:generate' to create a migration."));
    }

    process.exit(1);
  } catch (err) {
    error(`Failed to check schema: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

