import type { YamaEntities, EntityDefinition, EntityField } from "@yama/core";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Generate SQL column definition from entity field
 */
function generateSQLColumn(fieldName: string, field: EntityField, dbColumnName: string): string {
  let sqlType: string;
  const modifiers: string[] = [];

  // Determine SQL type
  if (field.dbType) {
    sqlType = field.dbType;
  } else {
    switch (field.type) {
      case "uuid":
        sqlType = "UUID";
        break;
      case "string":
        if (field.maxLength) {
          sqlType = `VARCHAR(${field.maxLength})`;
        } else {
          sqlType = "VARCHAR(255)";
        }
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

  // Add primary key
  if (field.primary) {
    modifiers.push("PRIMARY KEY");
  }

  // Add generated/default
  if (field.generated && field.type === "uuid") {
    modifiers.push("DEFAULT gen_random_uuid()");
  } else if (field.default !== undefined) {
    if (field.default === "now()" || field.default === "now") {
      modifiers.push("DEFAULT NOW()");
    } else if (typeof field.default === "string") {
      modifiers.push(`DEFAULT '${field.default.replace(/'/g, "''")}'`);
    } else if (typeof field.default === "number" || typeof field.default === "boolean") {
      modifiers.push(`DEFAULT ${field.default}`);
    }
  }

  // Add nullable/not null
  if (field.nullable === false || field.required) {
    modifiers.push("NOT NULL");
  }

  return `  ${dbColumnName} ${sqlType}${modifiers.length > 0 ? " " + modifiers.join(" ") : ""}`;
}

/**
 * Generate CREATE TABLE SQL for an entity
 */
function generateCreateTableSQL(entityDef: EntityDefinition): string {
  const columns: string[] = [];

  for (const [fieldName, field] of Object.entries(entityDef.fields)) {
    const dbColumnName = field.dbColumn || fieldName;
    columns.push(generateSQLColumn(fieldName, field, dbColumnName));
  }

  return `CREATE TABLE IF NOT EXISTS ${entityDef.table} (
${columns.join(",\n")}
);`;
}

/**
 * Generate CREATE INDEX SQL statements
 */
function generateIndexSQL(entityDef: EntityDefinition): string[] {
  const indexStatements: string[] = [];

  // Indexes from entity definition
  if (entityDef.indexes) {
    for (const index of entityDef.indexes) {
      const indexName = index.name || `${entityDef.table}_${index.fields.join("_")}_idx`;
      const fields = index.fields.map(f => {
        const field = entityDef.fields[f];
        return field?.dbColumn || f;
      }).join(", ");
      const unique = index.unique ? "UNIQUE " : "";
      indexStatements.push(`CREATE ${unique}INDEX IF NOT EXISTS ${indexName} ON ${entityDef.table} (${fields});`);
    }
  }

  // Indexes from field index: true
  for (const [fieldName, field] of Object.entries(entityDef.fields)) {
    if (field.index) {
      const dbColumnName = field.dbColumn || fieldName;
      const indexName = `${entityDef.table}_${dbColumnName}_idx`;
      indexStatements.push(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${entityDef.table} (${dbColumnName});`);
    }
  }

  return indexStatements;
}

/**
 * Generate migration SQL from entities
 */
export function generateMigrationSQL(entities: YamaEntities, migrationName?: string): string {
  const statements: string[] = [];

  // Add header comment
  statements.push(`-- Migration: ${migrationName || "auto-generated"}`);
  statements.push(`-- Generated from yama.yaml entities\n`);

  // Generate CREATE TABLE statements
  for (const [entityName, entityDef] of Object.entries(entities)) {
    statements.push(`-- Table: ${entityDef.table}`);
    statements.push(generateCreateTableSQL(entityDef));
    statements.push("");
  }

  // Generate CREATE INDEX statements
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const indexes = generateIndexSQL(entityDef);
    if (indexes.length > 0) {
      statements.push(`-- Indexes for ${entityDef.table}`);
      statements.push(...indexes);
      statements.push("");
    }
  }

  return statements.join("\n");
}

/**
 * Get next migration number
 */
function getNextMigrationNumber(migrationsDir: string): number {
  if (!existsSync(migrationsDir)) {
    return 1;
  }

  try {
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .map(f => {
        const match = f.match(/^(\d+)_/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);

    return files.length > 0 ? Math.max(...files) + 1 : 1;
  } catch {
    return 1;
  }
}

/**
 * Generate and save migration file
 */
export function generateMigrationFile(
  entities: YamaEntities,
  migrationsDir: string,
  migrationName?: string
): string {
  // Ensure migrations directory exists
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
  }

  // Get next migration number
  const migrationNumber = getNextMigrationNumber(migrationsDir);
  const timestamp = Date.now();
  const name = migrationName || "migration";
  const fileName = `${String(migrationNumber).padStart(4, "0")}_${name}.sql`;
  const filePath = join(migrationsDir, fileName);

  // Generate SQL
  const sql = generateMigrationSQL(entities, name);

  // Write file
  writeFileSync(filePath, sql, "utf-8");

  return filePath;
}

