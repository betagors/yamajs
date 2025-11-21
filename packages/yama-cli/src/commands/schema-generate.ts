import { existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.js";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.js";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import type { DatabaseConfig } from "@yama/core";
import {
  entitiesToModel,
  computeModelHash,
  computeDiff,
  diffToSteps,
  createMigration,
  serializeMigration,
  getCurrentModelHashFromDB,
} from "@yama/core";
import { initDatabase, getSQL, closeDatabase, generateSQLFromSteps } from "@yama/db-postgres";
import { success, error, info, warning, printBox, printHints } from "../utils/cli-utils.js";
import { promptMigrationName, confirm, hasDestructiveOperation } from "../utils/interactive.js";
import { generateMigrationNameFromBranch } from "../utils/git-utils.js";
import type { YamaEntities } from "@yama/core";

interface SchemaGenerateOptions {
  config?: string;
  name?: string;
  preview?: boolean;
  interactive?: boolean;
}

export async function schemaGenerateCommand(options: SchemaGenerateOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    loadEnvFile(configPath);
    let config = readYamaConfig(configPath) as {
      entities?: YamaEntities;
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;

    if (!config.entities || Object.keys(config.entities).length === 0) {
      error("No entities defined in yama.yaml");
      process.exit(1);
    }

    const configDir = getConfigDir(configPath);
    const migrationsDir = join(configDir, "migrations");

    // Compute target model
    const targetModel = entitiesToModel(config.entities);
    const targetHash = targetModel.hash;

    // Get current model hash from database
    let currentHash: string | null = null;
    if (config.database) {
      try {
        initDatabase(config.database);
        const sql = getSQL();

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

        await closeDatabase();
      } catch (err) {
        // Database connection failed - assume empty database
        info("Database connection failed, assuming empty database for first migration");
        await closeDatabase().catch(() => {});
        currentHash = null;
      }
    }

    // If no current hash, start from empty
    const fromHash = currentHash || ""; // Empty string means first migration

    // Check if there are changes
    if (fromHash && fromHash === targetHash) {
      info("Schema is already in sync. No migration needed.");
      process.exit(0);
    }

    // Generate migration name
    let migrationName = options.name;
    if (!migrationName) {
      if (options.interactive) {
        migrationName = await promptMigrationName(generateMigrationNameFromBranch());
      } else {
        migrationName = generateMigrationNameFromBranch();
      }
    }

    // Compute diff between current and target models
    let steps: any[] = [];
    
    if (!fromHash || fromHash === "") {
      // First migration - create all tables from entities
      for (const [entityName, entityDef] of Object.entries(config.entities)) {
        const columns = Object.entries(entityDef.fields).map(([fieldName, field]) => {
          const dbColumnName = field.dbColumn || fieldName;
          let sqlType = field.dbType || field.type.toUpperCase();
          
          // Map types to SQL
          if (!field.dbType) {
            switch (field.type) {
              case "uuid":
                sqlType = "UUID";
                break;
              case "string":
                sqlType = field.maxLength ? `VARCHAR(${field.maxLength})` : "VARCHAR(255)";
                break;
              case "text":
                sqlType = "TEXT";
                break;
              case "number":
              case "integer":
                sqlType = "INTEGER";
                break;
              case "boolean":
                sqlType = "BOOLEAN";
                break;
              case "timestamp":
                sqlType = "TIMESTAMP";
                break;
              case "jsonb":
                sqlType = "JSONB";
                break;
              default:
                sqlType = "TEXT";
            }
          }

          return {
            name: dbColumnName,
            type: sqlType,
            nullable: field.nullable !== false && !field.required,
            primary: field.primary || false,
            default: field.default,
            generated: field.generated,
          };
        });

        steps.push({
          type: "add_table",
          table: entityDef.table,
          columns,
        });

        // Add indexes
        if (entityDef.indexes) {
          for (const index of entityDef.indexes) {
            steps.push({
              type: "add_index",
              table: entityDef.table,
              index: {
                name: index.name || `${entityDef.table}_${index.fields.join("_")}_idx`,
                columns: index.fields.map((f) => {
                  const field = entityDef.fields[f];
                  return field?.dbColumn || f;
                }),
                unique: index.unique || false,
              },
            });
          }
        }

        // Add field-level indexes
        for (const [fieldName, field] of Object.entries(entityDef.fields)) {
          if (field.index) {
            const dbColumnName = field.dbColumn || fieldName;
            steps.push({
              type: "add_index",
              table: entityDef.table,
              index: {
                name: `${entityDef.table}_${dbColumnName}_idx`,
                columns: [dbColumnName],
                unique: false,
              },
            });
          }
        }
      }
    } else {
      // TODO: For subsequent migrations, we need to:
      // 1. Reconstruct current model from applied migrations
      // 2. Compute diff between current and target
      // 3. Generate steps from diff
      // For v0, we'll show a message that diff-based generation needs the current model
      warning("Diff-based migration generation requires current model reconstruction.");
      warning("This will be implemented in a future version.");
      info("For now, please manually create migration steps or use schema:apply with existing migrations.");
      process.exit(1);
    }

    const migration = createMigration(fromHash, targetHash, steps, migrationName);

    // Generate SQL from steps
    const sqlContent = generateSQLFromSteps(steps);

    if (options.preview) {
      printBox(
        `Migration Preview: ${migrationName}\n\n` +
        `From: ${fromHash ? fromHash.substring(0, 8) + "..." : "empty"}\n` +
        `To:   ${targetHash.substring(0, 8)}...\n\n` +
        `Steps: ${steps.length}`,
        { borderColor: "cyan" }
      );
      if (steps.length === 0) {
        info("No changes detected. Schema is in sync.");
      }
      return;
    }

    // Ensure migrations directory exists
    if (!existsSync(migrationsDir)) {
      mkdirSync(migrationsDir, { recursive: true });
    }

    // Get next migration number
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".sql"))
      .map((f) => {
        const match = f.match(/^(\d+)_/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    const migrationNumber = migrationFiles.length > 0 ? Math.max(...migrationFiles) + 1 : 1;
    const fileName = `${String(migrationNumber).padStart(4, "0")}_${migrationName}`;

    // Check for destructive operations
    const hasDestructive = steps.some(hasDestructiveOperation);

    if (options.interactive && hasDestructive) {
      const confirmed = await confirm(
        "This migration contains destructive operations. Continue?",
        false
      );
      if (!confirmed) {
        info("Migration generation cancelled.");
        return;
      }
    }

    // Write migration YAML
    const yamlPath = join(migrationsDir, `${fileName}.yaml`);
    writeFileSync(yamlPath, serializeMigration(migration), "utf-8");

    // Write SQL
    const sqlPath = join(migrationsDir, `${fileName}.sql`);
    writeFileSync(sqlPath, sqlContent || `-- Migration: ${migrationName}\n-- No changes\n`, "utf-8");

    success(`Generated migration: ${fileName}.yaml`);
    success(`Generated SQL: ${fileName}.sql`);

    printHints([
      "Review the migration files before applying",
      "Run 'yama schema:apply' to apply the migration",
    ]);
  } catch (err) {
    error(`Failed to generate migration: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

