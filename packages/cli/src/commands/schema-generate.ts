import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import type { DatabaseConfig, YamaSchemas, YamaEntities } from "@betagors/yama-core";
import {
  entitiesToModel,
  computeDiff,
  diffToSteps,
  createSnapshot,
  saveSnapshot,
  snapshotExists,
  getCurrentSnapshot,
  createTransition,
  saveTransition,
  updateState,
  type Model,
  type TableModel,
  type ColumnModel,
} from "@betagors/yama-core";
import { success, error, info, warning, dim, fmt } from "../utils/cli-utils.ts";
import { promptMigrationName, confirm, hasDestructiveOperation } from "../utils/interactive.ts";
import { getDatabasePlugin, getDatabasePluginAndConfig } from "../utils/db-plugin.ts";

/**
 * Extract entities from schemas that have database properties
 */
function extractEntitiesFromSchemas(schemas?: YamaSchemas): YamaEntities {
  const entities: YamaEntities = {};
  
  if (!schemas || typeof schemas !== 'object') {
    return entities;
  }
  
  for (const [schemaName, schemaDef] of Object.entries(schemas)) {
    if (schemaDef && typeof schemaDef === 'object' && 'database' in schemaDef) {
      const dbConfig = (schemaDef as any).database;
      if (dbConfig && (
        (typeof dbConfig === 'object' && 'table' in dbConfig) || 
        typeof dbConfig === 'string'
      )) {
        entities[schemaName] = schemaDef as any;
      }
    }
  }
  
  return entities;
}

/**
 * Normalize entities to ensure table names are set
 */
function normalizeEntities(entities: YamaEntities): YamaEntities {
  const normalized: YamaEntities = {};
  
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const dbConfig = typeof entityDef.database === "string"
      ? { table: entityDef.database }
      : entityDef.database;
    
    const defaultTableName = entityName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
    
    const tableName = dbConfig?.table || entityDef.table || defaultTableName;
    
    normalized[entityName] = {
      ...entityDef,
      table: tableName,
      database: dbConfig || { table: tableName }
    };
  }
  
  return normalized;
}

/**
 * Generate descriptive name from steps
 */
function generateNameFromSteps(steps: any[]): string {
  if (steps.length === 0) return "no_changes";

  const addTables = steps.filter(s => s.type === "add_table");
  const dropTables = steps.filter(s => s.type === "drop_table");
  const addColumns = steps.filter(s => s.type === "add_column");
  const modifyColumns = steps.filter(s => s.type === "modify_column");
  const addIndexes = steps.filter(s => s.type === "add_index");

  if (addTables.length === 1 && steps.length <= 1 + addIndexes.length) {
    return `create_${addTables[0].table}`;
  }

  if (dropTables.length === 1 && steps.length === 1) {
    return `drop_${dropTables[0].table}`;
  }

  if (addColumns.length === 1 && steps.length === 1) {
    return `add_${addColumns[0].column.name}_to_${addColumns[0].table}`;
  }

  if (modifyColumns.length === 1 && steps.length === 1) {
    return `modify_${modifyColumns[0].column}_in_${modifyColumns[0].table}`;
  }

  const parts: string[] = [];
  if (addTables.length > 0) parts.push(addTables.length === 1 ? `create_${addTables[0].table}` : `create_${addTables.length}_tables`);
  if (dropTables.length > 0) parts.push(`drop_${dropTables.length}_tables`);
  if (addColumns.length > 0) parts.push(`add_${addColumns.length}_columns`);
  if (modifyColumns.length > 0) parts.push(`modify_${modifyColumns.length}_columns`);

  return parts.join("_") || "schema_update";
}

/**
 * Read current database schema into a Model
 */
async function readCurrentModelFromDB(sql: any): Promise<Model> {
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
        sqlType = col.data_type.toUpperCase();
        if (col.character_maximum_length && !sqlType.includes("(")) {
          sqlType = `${sqlType}(${col.character_maximum_length})`;
        }
      }

      let defaultValue: unknown = undefined;
      if (col.column_default) {
        const defaultStr = col.column_default;
        if (defaultStr.includes("gen_random_uuid()")) {
          defaultValue = undefined;
        } else if (defaultStr.includes("now()")) {
          defaultValue = "now()";
        } else if (defaultStr === "'false'::boolean" || defaultStr === "false") {
          defaultValue = false;
        } else if (defaultStr === "'true'::boolean" || defaultStr === "true") {
          defaultValue = true;
        } else if (defaultStr.match(/^'\d+'::integer$/)) {
          defaultValue = parseInt(defaultStr.match(/^'(\d+)'/)?.[1] || "0", 10);
        } else if (defaultStr.startsWith("'") && defaultStr.endsWith("'")) {
          defaultValue = defaultStr.slice(1, -1);
        } else {
          defaultValue = defaultStr;
        }
      }

      const isPrimary = col.column_name === primaryKeyColumn;
      const isGenerated = col.is_identity === "YES" || (isPrimary && sqlType === "UUID" && col.column_default?.includes("gen_random_uuid"));
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

    const indexes: { name: string; columns: string[]; unique: boolean }[] = [];
    for (const idx of indexesResult as Array<{
      indexname: string;
      indexdef: string;
      indisunique: boolean;
    }>) {
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
      foreignKeys: [],
    });
  }

  const { createHash } = await import("crypto");
  const normalized = JSON.stringify(
    Array.from(tables.entries()).map(([name, table]) => ({
      name,
      columns: Array.from(table.columns.entries()).map(([colName, col]) => ({
        name: colName, type: col.type, nullable: col.nullable, primary: col.primary, default: col.default, generated: col.generated,
      })),
      indexes: table.indexes.map((idx) => ({ name: idx.name, columns: idx.columns, unique: idx.unique })),
    })),
    null, 0
  );

  const hash = createHash("sha256").update(normalized).digest("hex");

  return { hash, entities: {}, tables };
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
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      schemas?: YamaSchemas;
      plugins?: Record<string, Record<string, unknown>> | string[];
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;

    const allEntities = extractEntitiesFromSchemas(config.schemas);
    if (!allEntities || Object.keys(allEntities).length === 0) {
      error("No entities found. Add schemas with 'database:' property.");
      process.exit(1);
    }

    const normalizedEntities = normalizeEntities(allEntities);
    const configDir = getConfigDir(configPath);

    // Create target model from entities
    const targetModel = entitiesToModel(normalizedEntities);
    const targetHash = targetModel.hash;

    // Get current snapshot from state
    const currentSnapshotHash = getCurrentSnapshot(configDir, environment);

    // Check if target snapshot already exists (no changes)
    if (snapshotExists(configDir, targetHash)) {
      if (currentSnapshotHash === targetHash) {
        info("Schema is in sync. No changes needed.");
        return;
      }
      info(`Snapshot ${targetHash.substring(0, 8)} already exists.`);
    }

    // Read current database schema to compute diff
    let fromModel: Model;
    let dbPlugin: any;
    
    try {
      const { plugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
      dbPlugin = plugin;
      await dbPlugin.client.initDatabase(dbConfig);
      const sql = dbPlugin.client.getSQL();
      fromModel = await readCurrentModelFromDB(sql);
      await dbPlugin.client.closeDatabase();
    } catch (err) {
      // No database or empty - use empty model
      fromModel = { hash: "", entities: {}, tables: new Map() };
      info("No database connection. Using empty baseline.");
    }

    // Compute diff
    const diff = computeDiff(fromModel, targetModel);
    const steps = diffToSteps(diff, fromModel, targetModel);

    if (steps.length === 0) {
      info("No schema changes detected.");
      return;
    }

    // Show changes
    console.log("");
    console.log(fmt.bold("Schema Changes"));
    console.log(dim("─".repeat(40)));
    
    for (const step of steps) {
      if (step.type === "add_table") {
        console.log(fmt.green(`+ Table: ${step.table}`));
        for (const col of step.columns) {
          console.log(dim(`    ${col.name}: ${col.type}${col.nullable ? "" : " NOT NULL"}`));
        }
      } else if (step.type === "drop_table") {
        console.log(fmt.red(`- Table: ${step.table}`));
      } else if (step.type === "add_column") {
        console.log(fmt.green(`+ ${step.table}.${step.column.name}: ${step.column.type}`));
      } else if (step.type === "drop_column") {
        console.log(fmt.red(`- ${step.table}.${step.column}`));
      } else if (step.type === "modify_column") {
        console.log(fmt.yellow(`~ ${step.table}.${step.column}`));
      } else if (step.type === "add_index") {
        console.log(fmt.cyan(`+ Index: ${step.index.name} on ${step.table}`));
      } else if (step.type === "drop_index") {
        console.log(fmt.red(`- Index: ${step.index} on ${step.table}`));
      }
    }
    console.log("");

    if (options.preview) {
      console.log(dim(`From: ${fromModel.hash ? fromModel.hash.substring(0, 8) : "empty"}`));
      console.log(dim(`To:   ${targetHash.substring(0, 8)}`));
      console.log(dim(`Steps: ${steps.length}`));
      return;
    }

    // Check for destructive operations
    const hasDestructive = steps.some(hasDestructiveOperation);
    if (hasDestructive && options.interactive) {
      warning("This includes destructive operations (DROP TABLE/COLUMN).");
      const confirmed = await confirm("Continue?", false);
      if (!confirmed) {
        info("Cancelled.");
        return;
      }
    }

    // Get description
    let description = options.name;
    if (!description) {
      description = generateNameFromSteps(steps);
      if (options.interactive) {
        description = await promptMigrationName(description);
      }
    }

    // Create and save snapshot
    const snapshot = createSnapshot(
      normalizedEntities,
      {
        createdAt: new Date().toISOString(),
        createdBy: process.env.USER || "yama",
        description,
      },
      currentSnapshotHash || undefined
    );

    saveSnapshot(configDir, snapshot);

    // Create and save transition
    const transition = createTransition(
      fromModel.hash || "",
      targetHash,
      steps,
      {
        description,
        createdAt: new Date().toISOString(),
      }
    );

    saveTransition(configDir, transition);

    // Update state
    updateState(configDir, environment, targetHash);

    // Output
    console.log(fmt.bold("Created:"));
    console.log(`  Snapshot:   ${fmt.cyan(targetHash.substring(0, 8))}`);
    console.log(`  Transition: ${fmt.cyan(transition.hash.substring(0, 8))}`);
    console.log("");
    success(`Schema transition ready. Run 'yama deploy --env ${environment}' to apply.`);

  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
