import type { YamaEntities, EntityDefinition } from "../entities.js";
import { createHash } from "crypto";

/**
 * Represents the schema state of the database
 */
export interface Model {
  hash: string;
  entities: YamaEntities;
  tables: Map<string, TableModel>;
}

/**
 * Represents a table in the model
 */
export interface TableModel {
  name: string;
  columns: Map<string, ColumnModel>;
  indexes: IndexModel[];
  foreignKeys: ForeignKeyModel[];
}

/**
 * Represents a column in a table
 */
export interface ColumnModel {
  name: string;
  type: string;
  nullable: boolean;
  primary: boolean;
  default?: unknown;
  generated?: boolean;
}

/**
 * Represents an index
 */
export interface IndexModel {
  name: string;
  columns: string[];
  unique: boolean;
}

/**
 * Represents a foreign key
 */
export interface ForeignKeyModel {
  name: string;
  columns: string[];
  references: {
    table: string;
    columns: string[];
  };
}

/**
 * Normalize entities to a canonical JSON representation
 * This ensures consistent hashing regardless of field order
 */
function normalizeEntities(entities: YamaEntities): string {
  const normalized: Record<string, unknown> = {};
  
  // Sort entity names for consistency
  const sortedEntityNames = Object.keys(entities).sort();
  
  for (const entityName of sortedEntityNames) {
    const entity = entities[entityName];
    const normalizedEntity: {
      table: string;
      fields: Record<string, Record<string, unknown>>;
      indexes?: Array<{ name?: string; fields: string[]; unique: boolean }>;
    } = {
      table: entity.table,
      fields: {},
    };
    
    // Sort field names for consistency
    const sortedFieldNames = Object.keys(entity.fields).sort();
    
    for (const fieldName of sortedFieldNames) {
      const field = entity.fields[fieldName];
      // Normalize field by sorting keys and removing undefined values
      const normalizedField: Record<string, unknown> = {};
      const fieldKeys = Object.keys(field).sort() as Array<keyof typeof field>;
      
      for (const key of fieldKeys) {
        const value = field[key];
        if (value !== undefined) {
          normalizedField[key] = value;
        }
      }
      
      normalizedEntity.fields[fieldName] = normalizedField;
    }
    
    // Add indexes if present
    if (entity.indexes && entity.indexes.length > 0) {
      normalizedEntity.indexes = entity.indexes
        .map((idx) => ({
          name: idx.name,
          fields: [...idx.fields].sort(),
          unique: idx.unique || false,
        }))
        .sort((a, b) => (a.name || a.fields.join(",")).localeCompare(b.name || b.fields.join(",")));
    }
    
    normalized[entityName] = normalizedEntity;
  }
  
  return JSON.stringify(normalized, null, 0);
}

/**
 * Compute SHA-256 hash of entities
 */
export function computeModelHash(entities: YamaEntities): string {
  const normalized = normalizeEntities(entities);
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Convert entities to Model representation
 */
export function entitiesToModel(entities: YamaEntities): Model {
  const hash = computeModelHash(entities);
  const tables = new Map<string, TableModel>();
  
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const columns = new Map<string, ColumnModel>();
    
    for (const [fieldName, field] of Object.entries(entityDef.fields)) {
      const dbColumnName = field.dbColumn || fieldName;
      
      // Convert entity type to SQL type if dbType not provided
      let sqlType: string = field.dbType || "";
      if (!sqlType) {
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
            sqlType = String(field.type).toUpperCase();
        }
      }
      
      // Primary keys are always NOT NULL
      const isPrimary = field.primary || false;
      const nullable = isPrimary ? false : (field.nullable !== false && !field.required);
      
      columns.set(dbColumnName, {
        name: dbColumnName,
        type: sqlType,
        nullable: nullable,
        primary: isPrimary,
        default: field.default,
        generated: field.generated,
      });
    }
    
    const indexes: IndexModel[] = [];
    
    // Add indexes from entity definition
    if (entityDef.indexes) {
      for (const index of entityDef.indexes) {
        indexes.push({
          name: index.name || `${entityDef.table}_${index.fields.join("_")}_idx`,
          columns: index.fields.map((f) => {
            const field = entityDef.fields[f];
            return field?.dbColumn || f;
          }),
          unique: index.unique || false,
        });
      }
    }
    
    // Add indexes from field index: true
    for (const [fieldName, field] of Object.entries(entityDef.fields)) {
      if (field.index) {
        const dbColumnName = field.dbColumn || fieldName;
        indexes.push({
          name: `${entityDef.table}_${dbColumnName}_idx`,
          columns: [dbColumnName],
          unique: false,
        });
      }
    }
    
    tables.set(entityDef.table, {
      name: entityDef.table,
      columns,
      indexes,
      foreignKeys: [], // Foreign keys not yet supported in entity definitions
    });
  }
  
  return {
    hash,
    entities,
    tables,
  };
}

/**
 * Compare two models and return the difference
 * This is a placeholder - actual diff logic will be in diff.ts
 */
export interface MigrationDiff {
  fromHash: string;
  toHash: string;
  hasChanges: boolean;
}

export function compareModels(from: Model, to: Model): MigrationDiff {
  return {
    fromHash: from.hash,
    toHash: to.hash,
    hasChanges: from.hash !== to.hash,
  };
}

