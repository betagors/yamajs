import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import type { DatabaseConfig } from "@betagors/yama-core";
import {
  entitiesToModel,
  getCurrentSnapshot,
  findPath,
  loadSnapshot,
  updateState,
  snapshotExists,
  createSnapshot,
  saveSnapshot,
  createTransition,
  saveTransition,
  computeDiff,
  diffToSteps,
  type Model,
  type TableModel,
  type ColumnModel,
  type YamaEntities,
} from "@betagors/yama-core";
import {
  success,
  error,
  info,
  warning,
  dim,
  fmt,
  createSpinner,
  formatDuration,
} from "../utils/cli-utils.ts";
import { confirm, hasDestructiveOperation } from "../utils/interactive.ts";
import { getDatabasePluginAndConfig } from "../utils/db-plugin.ts";

/**
 * Split SQL into individual statements
 */
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  const lines = sql.split('\n');
  let currentStatement = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      if (currentStatement) currentStatement += '\n';
      continue;
    }
    
    currentStatement += (currentStatement ? '\n' : '') + line;
    
    if (trimmedLine.endsWith(';')) {
      const statement = currentStatement.trim();
      if (statement && !statement.startsWith('--')) {
        statements.push(statement);
      }
      currentStatement = '';
    }
  }
  
  const remaining = currentStatement.trim();
  if (remaining && !remaining.startsWith('--')) {
    statements.push(remaining);
  }
  
  return statements.filter(s => s.length > 0);
}

/**
 * Read current database schema into a Model
 */
async function readCurrentModelFromDB(sql: any): Promise<Model> {
  // Use unsafe() method for compatibility with both postgres and pglite
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

  const tables = new Map<string, TableModel>();

  for (const row of tablesResult as Array<{ table_name: string }>) {
    const tableName = row.table_name;

    const columnsResult = await sql.unsafe(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default, is_identity
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);

    const columns = new Map<string, ColumnModel>();
    let primaryKeyColumn: string | null = null;

    const pkResult = await sql.unsafe(`
      SELECT column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = '${tableName}' AND tc.constraint_type = 'PRIMARY KEY'
    `);

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
      let sqlType: string;
      if (col.data_type === "character varying" || col.data_type === "varchar") {
        sqlType = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : "VARCHAR(255)";
      } else if (col.data_type === "character" || col.data_type === "char") {
        sqlType = col.character_maximum_length ? `CHAR(${col.character_maximum_length})` : "CHAR(1)";
      } else {
        sqlType = col.data_type.toUpperCase();
      }

      const isPrimary = col.column_name === primaryKeyColumn;
      const isGenerated = col.is_identity === "YES";
      const nullable = isPrimary ? false : col.is_nullable === "YES";

      columns.set(col.column_name, {
        name: col.column_name,
        type: sqlType,
        nullable,
        primary: isPrimary,
        default: col.column_default ? col.column_default : undefined,
        generated: isGenerated,
      });
    }

    const indexesResult = await sql.unsafe(`
      SELECT i.indexname, i.indexdef, ix.indisunique
      FROM pg_indexes i
      JOIN pg_index ix ON i.indexname = (SELECT relname FROM pg_class WHERE oid = ix.indexrelid)
      WHERE i.schemaname = 'public' AND i.tablename = '${tableName}' AND i.indexname NOT LIKE '%_pkey'
    `);

    const indexes: { name: string; columns: string[]; unique: boolean }[] = [];
    for (const idx of indexesResult as Array<{ indexname: string; indexdef: string; indisunique: boolean }>) {
      const match = idx.indexdef.match(/\(([^)]+)\)/);
      indexes.push({
        name: idx.indexname,
        columns: match ? match[1].split(",").map((c) => c.trim().replace(/"/g, "")) : [],
        unique: idx.indisunique,
      });
    }

    tables.set(tableName, { name: tableName, columns, indexes, foreignKeys: [] });
  }

  const { createHash } = await import("crypto");
  const normalized = JSON.stringify(
    Array.from(tables.entries()).map(([name, table]) => ({
      name,
      columns: Array.from(table.columns.entries()).map(([colName, col]) => ({
        name: colName, type: col.type, nullable: col.nullable, primary: col.primary,
      })),
      indexes: table.indexes.map((idx) => ({ name: idx.name, columns: idx.columns, unique: idx.unique })),
    })),
    null, 0
  );

  return { hash: createHash("sha256").update(normalized).digest("hex"), entities: {}, tables };
}

interface SchemaApplyOptions {
  config?: string;
  env?: string;
  noApply?: boolean;
  interactive?: boolean;
  allowDestructive?: boolean;
}

export async function schemaApplyCommand(options: SchemaApplyOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      schemas?: any;
      plugins?: Record<string, Record<string, unknown>> | string[];
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;
    const configDir = getConfigDir(configPath);

    // Get database plugin
    const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
    await dbPlugin.client.initDatabase(dbConfig);
    const sql = dbPlugin.client.getSQL();

    // Ensure migration tracking table exists
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
      )
    `);

    // Get current state
    const currentSnapshotHash = getCurrentSnapshot(configDir, environment);

    // Read current DB model
    const currentDBModel = await readCurrentModelFromDB(sql);
    
    // Get target model from entities in config
    const entities = extractEntitiesFromSchemas(config.schemas);
    if (!entities || Object.keys(entities).length === 0) {
      info("No entities defined in config.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    const normalizedEntities = normalizeEntities(entities);
    const targetModel = entitiesToModel(normalizedEntities);

    // Check if already in sync
    if (currentDBModel.hash === targetModel.hash) {
      info("Database is in sync with schema.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Find or create transition
    let transition;
    const existingPath = currentSnapshotHash ? findPath(configDir, currentSnapshotHash, targetModel.hash) : null;
    
    if (existingPath && existingPath.transitions.length > 0) {
      transition = existingPath.transitions[0];
      info(`Using existing transition: ${transition.hash.substring(0, 8)}`);
    } else {
      // Create on-the-fly transition
      const diff = computeDiff(currentDBModel, targetModel);
      const steps = diffToSteps(diff, currentDBModel, targetModel);
      
      if (steps.length === 0) {
        info("No changes to apply.");
        await dbPlugin.client.closeDatabase();
        return;
      }

      // Create snapshot if needed
      if (!snapshotExists(configDir, targetModel.hash)) {
        const snapshot = createSnapshot(normalizedEntities, {
          createdAt: new Date().toISOString(),
          createdBy: process.env.USER || "yama",
          description: "Auto-generated on apply",
        }, currentSnapshotHash || undefined);
        saveSnapshot(configDir, snapshot);
      }

      transition = createTransition(
        currentDBModel.hash || "",
        targetModel.hash,
        steps,
        { description: "Auto-generated on apply", createdAt: new Date().toISOString() }
      );
      saveTransition(configDir, transition);
    }

    const steps = transition.steps;

    // Show what will be applied
    console.log("");
    console.log(fmt.bold("Changes to Apply"));
    console.log(dim("─".repeat(40)));
    
    let hasDestructive = false;
    for (const step of steps) {
      if (step.type === "add_table") {
        console.log(fmt.green(`+ CREATE TABLE ${step.table}`));
      } else if (step.type === "drop_table") {
        console.log(fmt.red(`- DROP TABLE ${step.table}`));
        hasDestructive = true;
      } else if (step.type === "add_column") {
        console.log(fmt.green(`+ ADD COLUMN ${step.table}.${step.column.name}`));
      } else if (step.type === "drop_column") {
        console.log(fmt.red(`- DROP COLUMN ${step.table}.${step.column}`));
        hasDestructive = true;
      } else if (step.type === "rename_column") {
        console.log(fmt.yellow(`~ RENAME COLUMN ${step.table}.${step.column} -> ${step.newName}`));
      } else if (step.type === "modify_column") {
        console.log(fmt.yellow(`~ ALTER COLUMN ${step.table}.${step.column}`));
      } else if (step.type === "add_index") {
        console.log(fmt.cyan(`+ CREATE INDEX ${step.index.name}`));
      } else if (step.type === "drop_index") {
        console.log(fmt.red(`- DROP INDEX ${step.index}`));
      }
    }
    console.log("");
    console.log(dim(`From: ${currentDBModel.hash ? currentDBModel.hash.substring(0, 8) : "empty"}`));
    console.log(dim(`To:   ${targetModel.hash.substring(0, 8)}`));
    console.log("");

    if (options.noApply) {
      info("Dry run - no changes applied.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Check destructive operations
    if (hasDestructive && !options.allowDestructive) {
      if (options.interactive) {
        warning("This includes destructive operations.");
        const confirmed = await confirm("Apply changes?", false);
        if (!confirmed) {
          info("Cancelled.");
          await dbPlugin.client.closeDatabase();
          return;
        }
      } else {
        error("Destructive operations detected. Use --allow-destructive to proceed.");
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
    }

    // Apply migration
    const spinner = createSpinner("Applying schema changes...");
    const startTime = Date.now();

    try {
      const sqlContent = dbPlugin.migrations.generateFromSteps(steps);
      
      if (sqlContent.trim()) {
        await sql.begin(async (tx: any) => {
          const statements = splitSQLStatements(sqlContent);
          for (const statement of statements) {
            if (statement.trim()) {
              await tx.unsafe(statement);
            }
          }

          // Record migration
          await tx.unsafe(`
            INSERT INTO _yama_migrations (name, type, from_model_hash, to_model_hash, description)
            VALUES (
              'transition_${transition.hash}',
              'schema',
              ${currentDBModel.hash ? `'${currentDBModel.hash}'` : 'NULL'},
              '${targetModel.hash}',
              ${transition.metadata.description ? `'${transition.metadata.description.replace(/'/g, "''")}'` : 'NULL'}
            )
            ON CONFLICT (name) DO NOTHING
          `);
        });
      }

      // Update state
      updateState(configDir, environment, targetModel.hash);

      const duration = Date.now() - startTime;
      spinner.succeed(`Applied ${steps.length} change(s) in ${formatDuration(duration)}`);
      console.log("");
      success(`Database updated to ${targetModel.hash.substring(0, 8)}`);

    } catch (err) {
      spinner.fail("Failed to apply changes");
      error(`${err instanceof Error ? err.message : String(err)}`);
      await dbPlugin.client.closeDatabase();
      process.exit(1);
    }

    await dbPlugin.client.closeDatabase();

  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Helper functions
function extractEntitiesFromSchemas(schemas?: any): YamaEntities {
  const entities: YamaEntities = {};
  if (!schemas) return entities;
  
  for (const [name, def] of Object.entries(schemas)) {
    if (def && typeof def === 'object' && 'database' in (def as any)) {
      entities[name] = def as any;
    }
  }
  return entities;
}

function normalizeEntities(entities: YamaEntities): YamaEntities {
  const normalized: YamaEntities = {};
  for (const [name, def] of Object.entries(entities)) {
    const dbConfig = typeof def.database === "string" ? { table: def.database } : def.database;
    const tableName = dbConfig?.table || def.table || name.toLowerCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
    normalized[name] = { ...def, table: tableName, database: dbConfig || { table: tableName } };
  }
  return normalized;
}
