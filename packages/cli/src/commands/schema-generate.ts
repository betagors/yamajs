import { existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
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
  type Model,
  type TableModel,
  type ColumnModel,
  type IndexModel,
  type YamaEntities,
} from "@yama/core";
import { success, error, info, warning, printBox, printHints } from "../utils/cli-utils.ts";
import { promptMigrationName, confirm, hasDestructiveOperation } from "../utils/interactive.ts";
import { generateMigrationNameFromBranch } from "../utils/git-utils.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";

/**
 * Normalize entities to ensure table names are set
 */
function normalizeEntities(entities: YamaEntities): YamaEntities {
  const normalized: YamaEntities = {};
  
  for (const [entityName, entityDef] of Object.entries(entities)) {
    // Convert entity name to snake_case for table name if not specified
    const defaultTableName = entityName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, ''); // Remove leading underscore
    
    normalized[entityName] = {
      ...entityDef,
      table: entityDef.table || defaultTableName
    };
  }
  
  return normalized;
}

/**
 * Generate descriptive migration name from steps
 */
function generateMigrationNameFromSteps(steps: any[]): string {
  if (steps.length === 0) {
    return "empty_migration";
  }

  // Count operations by type
  const addTables = steps.filter(s => s.type === "add_table");
  const dropTables = steps.filter(s => s.type === "drop_table");
  const addColumns = steps.filter(s => s.type === "add_column");
  const modifyColumns = steps.filter(s => s.type === "modify_column");
  const addIndexes = steps.filter(s => s.type === "add_index");

  // Single operation cases
  if (addTables.length === 1 && steps.length === 1) {
    return `create_${addTables[0].table}_table`;
  }
  
  if (addTables.length === 1 && addIndexes.length > 0 && steps.length === addTables.length + addIndexes.length) {
    return `create_${addTables[0].table}_table`;
  }

  if (dropTables.length === 1 && steps.length === 1) {
    return `drop_${dropTables[0].table}_table`;
  }

  if (addColumns.length === 1 && steps.length === 1) {
    return `add_${addColumns[0].column.name}_to_${addColumns[0].table}`;
  }

  if (modifyColumns.length === 1 && steps.length === 1) {
    return `modify_${modifyColumns[0].column}_in_${modifyColumns[0].table}`;
  }

  // Multiple operations - create descriptive name
  const parts: string[] = [];
  
  if (addTables.length > 0) {
    if (addTables.length === 1) {
      parts.push(`create_${addTables[0].table}`);
    } else {
      parts.push(`create_${addTables.length}_tables`);
    }
  }
  
  if (dropTables.length > 0) {
    parts.push(`drop_${dropTables.length}_tables`);
  }
  
  if (addColumns.length > 0) {
    parts.push(`add_${addColumns.length}_columns`);
  }
  
  if (modifyColumns.length > 0) {
    parts.push(`modify_${modifyColumns.length}_columns`);
  }
  
  if (addIndexes.length > 0) {
    parts.push(`add_${addIndexes.length}_indexes`);
  }

  return parts.join("_") || "schema_update";
}

/**
 * Read current database schema and convert to Model
 */
async function readCurrentModelFromDB(sql: any): Promise<Model> {
  // Get all tables (excluding system tables, migration tables, and snapshot tables)
  const tablesResult = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '_yama_%'
      AND table_name NOT LIKE '%_before_%'
      AND table_name NOT LIKE '%_snapshot_%'
    ORDER BY table_name
  `;

  const tables = new Map<string, TableModel>();

  for (const row of tablesResult as Array<{ table_name: string }>) {
    const tableName = row.table_name;

    // Get columns
    const columnsResult = await sql`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        is_identity
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;

    const columns = new Map<string, ColumnModel>();
    let primaryKeyColumn: string | null = null;

    // Get primary key
    const pkResult = await sql`
      SELECT column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.table_name = ${tableName}
        AND tc.constraint_type = 'PRIMARY KEY'
    `;

    if (pkResult && pkResult.length > 0) {
      primaryKeyColumn = (pkResult[0] as { column_name: string }).column_name;
    }

    for (const col of columnsResult as Array<{
      column_name: string;
      data_type: string;
      character_maximum_length: number | null;
      is_nullable: string;
      column_default: string | null;
      is_identity: string;
    }>) {
      // Normalize PostgreSQL data types to SQL types
      let sqlType: string;
      if (col.data_type === "character varying" || col.data_type === "varchar") {
        sqlType = col.character_maximum_length 
          ? `VARCHAR(${col.character_maximum_length})`
          : "VARCHAR(255)";
      } else if (col.data_type === "character" || col.data_type === "char") {
        sqlType = col.character_maximum_length
          ? `CHAR(${col.character_maximum_length})`
          : "CHAR(1)";
      } else {
        // Map other types to uppercase SQL types
        sqlType = col.data_type.toUpperCase();
        if (col.character_maximum_length && !sqlType.includes("(")) {
          sqlType = `${sqlType}(${col.character_maximum_length})`;
        }
      }

      // Parse default value
      let defaultValue: unknown = undefined;
      if (col.column_default) {
        const defaultStr = col.column_default;
        if (defaultStr.includes("gen_random_uuid()")) {
          defaultValue = undefined; // Generated, not a default
        } else if (defaultStr.includes("now()")) {
          defaultValue = "now()";
        } else if (defaultStr === "'false'::boolean" || defaultStr === "false") {
          defaultValue = false;
        } else if (defaultStr === "'true'::boolean" || defaultStr === "true") {
          defaultValue = true;
        } else if (defaultStr.match(/^'\d+'::integer$/)) {
          // Integer default like '0'::integer
          defaultValue = parseInt(defaultStr.match(/^'(\d+)'/)?.[1] || "0", 10);
        } else if (defaultStr.startsWith("'") && defaultStr.endsWith("'")) {
          defaultValue = defaultStr.slice(1, -1);
        } else {
          defaultValue = defaultStr;
        }
      }

      const isPrimary = col.column_name === primaryKeyColumn;
      const isGenerated = col.is_identity === "YES" || (isPrimary && sqlType === "UUID" && col.column_default?.includes("gen_random_uuid"));

      // Primary keys are always NOT NULL in PostgreSQL, regardless of what is_nullable says
      const nullable = isPrimary ? false : col.is_nullable === "YES";

      columns.set(col.column_name, {
        name: col.column_name,
        type: sqlType,
        nullable: nullable,
        primary: isPrimary,
        default: defaultValue,
        generated: isGenerated,
      });
    }

    // Get indexes
    const indexesResult = await sql`
      SELECT
        i.indexname,
        i.indexdef,
        ix.indisunique
      FROM pg_indexes i
      JOIN pg_index ix ON i.indexname = (SELECT relname FROM pg_class WHERE oid = ix.indexrelid)
      WHERE i.schemaname = 'public' 
        AND i.tablename = ${tableName}
        AND i.indexname NOT LIKE '%_pkey'
    `;

    const indexes: IndexModel[] = [];
    for (const idx of indexesResult as Array<{
      indexname: string;
      indexdef: string;
      indisunique: boolean;
    }>) {
      // Extract column names from index definition
      const match = idx.indexdef.match(/\(([^)]+)\)/);
      const columnNames = match
        ? match[1].split(",").map((c) => c.trim().replace(/"/g, ""))
        : [];

      indexes.push({
        name: idx.indexname,
        columns: columnNames,
        unique: idx.indisunique,
      });
    }

    tables.set(tableName, {
      name: tableName,
      columns,
      indexes,
      foreignKeys: [], // Foreign keys not yet implemented in schema reading
    });
  }

  // Compute hash from tables structure
  const normalized = JSON.stringify(
    Array.from(tables.entries()).map(([name, table]) => ({
      name,
      columns: Array.from(table.columns.entries()).map(([colName, col]) => ({
        name: colName,
        type: col.type,
        nullable: col.nullable,
        primary: col.primary,
        default: col.default,
        generated: col.generated,
      })),
      indexes: table.indexes.map((idx) => ({
        name: idx.name,
        columns: idx.columns,
        unique: idx.unique,
      })),
    })),
    null,
    0
  );

  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(normalized).digest("hex");

  return {
    hash,
    entities: {}, // Empty since we're reading from DB, not entities
    tables,
  };
}

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
    const environment = process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      entities?: YamaEntities;
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;

    if (!config.entities || Object.keys(config.entities).length === 0) {
      error("No entities defined in yama.yaml");
      process.exit(1);
    }

    // Normalize entities to ensure table names are set
    const normalizedEntities = normalizeEntities(config.entities);

    const configDir = getConfigDir(configPath);
    const migrationsDir = join(configDir, "migrations");

    // Compute target model
    const targetModel = entitiesToModel(normalizedEntities);
    const targetHash = targetModel.hash;

    // Get current model hash from database
    let currentHash: string | null = null;
    if (config.database) {
      try {
        const dbPlugin = await getDatabasePlugin();
        await dbPlugin.client.initDatabase(config.database);
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
      } catch (err) {
        // Database connection failed - assume empty database
        info("Database connection failed, assuming empty database for first migration");
        try {
          const dbPlugin = await getDatabasePlugin();
          await dbPlugin.client.closeDatabase();
        } catch {}
        currentHash = null;
      }
    }

    // If no current hash, start from empty
    const fromHash = currentHash || ""; // Empty string means first migration

    // Compute diff between current and target models
    let steps: any[] = [];
    
    if (!fromHash || fromHash === "") {
      // First migration - create all tables from entities
      for (const [entityName, entityDef] of Object.entries(normalizedEntities)) {
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
      // Subsequent migrations - use diff-based generation
      // 1. Reconstruct current model from database schema
      // 2. Compute diff between current and target
      // 3. Generate steps from diff
      
      if (!config.database) {
        error("Database configuration required for diff-based migration generation");
        process.exit(1);
      }

      try {
        const dbPlugin = await getDatabasePlugin();
        await dbPlugin.client.initDatabase(config.database);
        const sql = dbPlugin.client.getSQL();

        // Read current database schema
        const currentModel = await readCurrentModelFromDB(sql);
        await dbPlugin.client.closeDatabase();

        // Check if database schema matches target (after reading actual schema)
        if (currentModel.hash === targetHash) {
          info("Schema is already in sync. No migration needed.");
          process.exit(0);
        }

        // Compute target model from yama.yaml
        const targetModel = entitiesToModel(normalizedEntities);

        // Compute diff
        const diff = computeDiff(currentModel, targetModel);

        // Convert diff to steps
        steps = diffToSteps(diff, currentModel, targetModel);

        if (steps.length === 0) {
          info("No changes detected. Schema is already in sync.");
          process.exit(0);
        }

        info(`Detected ${steps.length} change(s) to apply`);
      } catch (err) {
        try {
          const dbPlugin = await getDatabasePlugin();
          await dbPlugin.client.closeDatabase();
        } catch {}
        error(`Failed to read current database schema: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    }

    // Generate migration name from steps if not provided
    let migrationName = options.name;
    if (!migrationName) {
      const descriptiveName = generateMigrationNameFromSteps(steps);
      if (options.interactive) {
        migrationName = await promptMigrationName(descriptiveName);
      } else {
        migrationName = descriptiveName;
      }
    }

    const migration = createMigration(fromHash, targetHash, steps, migrationName);

    // Generate SQL from steps
    const dbPlugin = await getDatabasePlugin();

    const sqlContent = dbPlugin.migrations.generateFromSteps(steps);

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

    // Generate timestamp-based migration name (YYYYMMDDHHmmss format)
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
      .replace('T', '');
    // Format: YYYYMMDDHHmmss (14 digits)
    const timestampPrefix = timestamp.substring(0, 14);
    const fileName = `${timestampPrefix}_${migrationName}`;

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

