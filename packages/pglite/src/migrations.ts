import type { YamaEntities, EntityDefinition, EntityField, MigrationStepUnion } from "@betagors/yama-core";
import { parseFieldDefinition, DatabaseTypeMapper } from "@betagors/yama-core";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

/**
 * Generate SQL column definition from entity field
 */
function generateSQLColumn(fieldName: string, field: EntityField, dbColumnName: string): string {
  let sqlType: string;
  const modifiers: string[] = [];

  // Determine SQL type using new type system
  if (field.dbType) {
    sqlType = field.dbType;
  } else {
    // Convert EntityField to FieldType for DatabaseTypeMapper
    const fieldType = {
      type: field.type as any,
      nullable: field.nullable !== false && !field.required,
      array: false,
      length: (field as any).length,
      maxLength: field.maxLength,
      minLength: field.minLength,
      precision: (field as any).precision,
      scale: (field as any).scale,
      currency: (field as any).currency,
      enumValues: field.enum as string[],
      pattern: field.pattern,
    };
    
    // Use DatabaseTypeMapper for PostgreSQL (PGlite uses PostgreSQL types)
    sqlType = DatabaseTypeMapper.toPostgreSQL(fieldType);
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
function generateCreateTableSQL(entityDef: EntityDefinition, availableEntities: Set<string>): string {
  const columns: string[] = [];

  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
    // Skip inline relations
    if (field._isInlineRelation) {
      continue;
    }
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
function generateIndexSQL(entityDef: EntityDefinition, availableEntities: Set<string>): string[] {
  const indexStatements: string[] = [];

  // Indexes from entity definition
  if (entityDef.indexes) {
    for (const index of entityDef.indexes) {
      const indexName = index.name || `${entityDef.table}_${index.fields.join("_")}_idx`;
      const fields = index.fields.map(f => {
        const fieldDef = entityDef.fields[f];
        if (!fieldDef) return f;
        const field = parseFieldDefinition(f, fieldDef, availableEntities);
        return field.dbColumn || f;
      }).join(", ");
      const unique = index.unique ? "UNIQUE " : "";
      indexStatements.push(`CREATE ${unique}INDEX IF NOT EXISTS ${indexName} ON ${entityDef.table} (${fields});`);
    }
  }

  // Indexes from field index: true
  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
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

  const availableEntities = new Set(Object.keys(entities));

  // Generate CREATE TABLE statements
  for (const [entityName, entityDef] of Object.entries(entities)) {
    statements.push(`-- Table: ${entityDef.table}`);
    statements.push(generateCreateTableSQL(entityDef, availableEntities));
    statements.push("");
  }

  // Generate CREATE INDEX statements
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const indexes = generateIndexSQL(entityDef, availableEntities);
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

/**
 * Generate SQL from migration steps
 */
export function generateSQLFromSteps(steps: MigrationStepUnion[]): string {
  const statements: string[] = [];

  for (const step of steps) {
    switch (step.type) {
      case "add_table":
        statements.push(`-- Add table: ${step.table}`);
        const columns = step.columns.map((col) => {
          const parts: string[] = [`  ${col.name} ${col.type}`];
          if (col.primary) {
            parts.push("PRIMARY KEY");
          }
          if (col.generated && col.type === "UUID") {
            parts.push("DEFAULT gen_random_uuid()");
          } else if (col.default !== undefined) {
            if (col.default === "now()" || col.default === "now") {
              parts.push("DEFAULT NOW()");
            } else if (typeof col.default === "string") {
              parts.push(`DEFAULT '${String(col.default).replace(/'/g, "''")}'`);
            } else {
              parts.push(`DEFAULT ${col.default}`);
            }
          }
          if (!col.nullable) {
            parts.push("NOT NULL");
          }
          return parts.join(" ");
        });
        statements.push(`CREATE TABLE IF NOT EXISTS ${step.table} (\n${columns.join(",\n")}\n);`);
        break;

      case "drop_table":
        statements.push(`-- Drop table: ${step.table}`);
        statements.push(`DROP TABLE IF EXISTS ${step.table};`);
        break;

      case "add_column":
        statements.push(`-- Add column: ${step.table}.${step.column.name}`);
        let columnDef = `ALTER TABLE ${step.table} ADD COLUMN ${step.column.name} ${step.column.type}`;
        if (step.column.generated && step.column.type === "UUID") {
          columnDef += " DEFAULT gen_random_uuid()";
        } else if (step.column.default !== undefined) {
          if (step.column.default === "now()" || step.column.default === "now") {
            columnDef += " DEFAULT NOW()";
          } else if (typeof step.column.default === "string") {
            columnDef += ` DEFAULT '${String(step.column.default).replace(/'/g, "''")}'`;
          } else {
            columnDef += ` DEFAULT ${step.column.default}`;
          }
        }
        if (!step.column.nullable) {
          columnDef += " NOT NULL";
        }
        statements.push(columnDef + ";");
        break;

      case "drop_column":
        statements.push(`-- Drop column: ${step.table}.${step.column}`);
        // Use CASCADE to automatically drop indexes, constraints, and other dependencies
        statements.push(`ALTER TABLE ${step.table} DROP COLUMN IF EXISTS ${step.column} CASCADE;`);
        break;

      case "rename_column":
        statements.push(`-- Rename column: ${step.table}.${step.column} -> ${step.newName}`);
        // PostgreSQL stores unquoted identifiers as lowercase
        // Old name is lowercase (from database), new name should be camelCase (quoted)
        // If old name might be quoted, try both - but typically it's lowercase
        statements.push(`ALTER TABLE ${step.table} RENAME COLUMN "${step.column}" TO "${step.newName}";`);
        break;

      case "modify_column":
        statements.push(`-- Modify column: ${step.table}.${step.column}`);
        // PostgreSQL ALTER COLUMN syntax
        if (step.changes.type) {
          statements.push(`ALTER TABLE ${step.table} ALTER COLUMN ${step.column} TYPE ${step.changes.type};`);
        }
        if (step.changes.nullable !== undefined) {
          if (step.changes.nullable) {
            statements.push(`ALTER TABLE ${step.table} ALTER COLUMN ${step.column} DROP NOT NULL;`);
          } else {
            statements.push(`ALTER TABLE ${step.table} ALTER COLUMN ${step.column} SET NOT NULL;`);
          }
        }
        if (step.changes.default !== undefined) {
          if (step.changes.default === null) {
            statements.push(`ALTER TABLE ${step.table} ALTER COLUMN ${step.column} DROP DEFAULT;`);
          } else {
            const defaultVal = step.changes.default === "now()" || step.changes.default === "now"
              ? "NOW()"
              : typeof step.changes.default === "string"
              ? `'${String(step.changes.default).replace(/'/g, "''")}'`
              : String(step.changes.default);
            statements.push(`ALTER TABLE ${step.table} ALTER COLUMN ${step.column} SET DEFAULT ${defaultVal};`);
          }
        }
        break;

      case "add_index":
        statements.push(`-- Add index: ${step.index.name} on ${step.table}`);
        const unique = step.index.unique ? "UNIQUE " : "";
        // Quote column names to preserve case (they should be camelCase after renames)
        const quotedColumns = step.index.columns.map(col => `"${col}"`).join(", ");
        statements.push(
          `CREATE ${unique}INDEX IF NOT EXISTS ${step.index.name} ON ${step.table} (${quotedColumns});`
        );
        break;

      case "drop_index":
        statements.push(`-- Drop index: ${step.index} on ${step.table}`);
        statements.push(`DROP INDEX IF EXISTS ${step.index};`);
        break;

      case "add_foreign_key":
        statements.push(`-- Add foreign key: ${step.foreignKey.name} on ${step.table}`);
        statements.push(
          `ALTER TABLE ${step.table} ADD CONSTRAINT ${step.foreignKey.name} ` +
          `FOREIGN KEY (${step.foreignKey.columns.join(", ")}) ` +
          `REFERENCES ${step.foreignKey.references.table} (${step.foreignKey.references.columns.join(", ")});`
        );
        break;

      case "drop_foreign_key":
        statements.push(`-- Drop foreign key: ${step.foreignKey} on ${step.table}`);
        statements.push(`ALTER TABLE ${step.table} DROP CONSTRAINT IF EXISTS ${step.foreignKey};`);
        break;
    }
  }

  return statements.join("\n");
}

/**
 * Compute checksum for migration content
 */
export function computeMigrationChecksum(yamlContent: string, sqlContent: string): string {
  const combined = yamlContent + "\n" + sqlContent;
  return createHash("sha256").update(combined).digest("hex");
}

/**
 * Get migration table creation SQL with enhanced schema
 */
export function getMigrationTableSQL(): string {
  return `
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
  `;
}

/**
 * Get migration runs table creation SQL
 */
export function getMigrationRunsTableSQL(): string {
  return `
    CREATE TABLE IF NOT EXISTS _yama_migration_runs (
      id SERIAL PRIMARY KEY,
      migration_id INTEGER REFERENCES _yama_migrations(id) ON DELETE CASCADE,
      started_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP,
      status VARCHAR(20) DEFAULT 'running',
      error_message TEXT
    );
  `;
}

