import type { SchemaField, SchemaDefinition, YamaSchemas } from "./schemas";

/**
 * Entity field types supported by Yama
 */
export type EntityFieldType = "uuid" | "string" | "number" | "boolean" | "timestamp" | "text" | "jsonb" | "integer";

/**
 * Entity field definition
 */
export interface EntityField {
  type: EntityFieldType;
  dbType?: string; // PostgreSQL-specific type override (e.g., "varchar(255)")
  dbColumn?: string; // Explicit DB column name (for snake_case mapping)
  primary?: boolean;
  generated?: boolean; // Auto-generate (UUID, serial, etc.)
  nullable?: boolean;
  default?: unknown; // Default value or function name (e.g., "now()")
  index?: boolean; // Create index on this field
  
  // API schema mapping
  api?: string | false; // API field name or false to exclude
  apiFormat?: string; // Format hint for API (e.g., "date-time")
  
  // API validation rules
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
}

/**
 * Entity index definition
 */
export interface EntityIndex {
  fields: string[];
  name?: string;
  unique?: boolean;
}

/**
 * Entity definition
 */
export interface EntityDefinition {
  table: string; // Database table name
  fields: Record<string, EntityField>;
  indexes?: EntityIndex[];
  apiSchema?: string; // Optional custom API schema name (default: entity name)
}

/**
 * Collection of entity definitions
 */
export interface YamaEntities {
  [entityName: string]: EntityDefinition;
}

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  dialect: "postgresql" | "pglite";
  /**
   * Database connection URL.
   * For PostgreSQL: use a standard postgresql:// connection string.
   * For PGlite: use ":memory:" for in-memory, or a path for persistent storage.
   * Optional for PGlite (defaults to .yama/data/db/pglite for persistent storage).
   */
  url?: string;
  pool?: {
    min?: number;
    max?: number;
  };
  options?: Record<string, unknown>; // Dialect-specific options
}

/**
 * HTTP server configuration
 */
export interface ServerConfig {
  engine?: "fastify"; // Only fastify supported for now, defaults to "fastify"
  options?: Record<string, unknown>; // Engine-specific options
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert entity field type to schema field type
 */
function entityTypeToSchemaType(entityType: EntityFieldType): SchemaField["type"] {
  switch (entityType) {
    case "uuid":
    case "string":
    case "text":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "timestamp":
      return "string";
    case "jsonb":
      return "object";
    default:
      return "string";
  }
}

/**
 * Convert entity field to schema field
 */
function entityFieldToSchemaField(
  fieldName: string,
  entityField: EntityField
): { apiFieldName: string; schemaField: SchemaField } | null {
  // Exclude if api is explicitly false
  if (entityField.api === false) {
    return null;
  }

  // Determine API field name
  const apiFieldName = entityField.api && typeof entityField.api === "string"
    ? entityField.api
    : entityField.dbColumn
    ? snakeToCamel(entityField.dbColumn)
    : fieldName;

  // Convert entity type to schema type
  const schemaType = entityTypeToSchemaType(entityField.type);

  const schemaField: SchemaField = {
    type: schemaType,
    required: entityField.required,
  };

  // Add format for timestamps
  if (entityField.type === "timestamp") {
    schemaField.format = entityField.apiFormat || "date-time";
  }

  // Add validation rules
  if (entityField.minLength !== undefined) {
    schemaField.min = entityField.minLength;
  }
  if (entityField.maxLength !== undefined) {
    schemaField.max = entityField.maxLength;
  }
  if (entityField.min !== undefined) {
    schemaField.min = entityField.min;
  }
  if (entityField.max !== undefined) {
    schemaField.max = entityField.max;
  }
  if (entityField.pattern) {
    schemaField.pattern = entityField.pattern;
  }
  if (entityField.enum) {
    schemaField.enum = entityField.enum;
  }

  // Add default if specified
  if (entityField.default !== undefined) {
    schemaField.default = entityField.default;
  }

  return { apiFieldName, schemaField };
}

/**
 * Convert entity definition to API schema definition
 */
export function entityToSchema(
  entityName: string,
  entityDef: EntityDefinition,
  entities?: YamaEntities
): SchemaDefinition {
  const schemaFields: Record<string, SchemaField> = {};

  for (const [fieldName, entityField] of Object.entries(entityDef.fields)) {
    const result = entityFieldToSchemaField(fieldName, entityField);
    if (result) {
      schemaFields[result.apiFieldName] = result.schemaField;
    }
  }

  return {
    fields: schemaFields,
  };
}

/**
 * Convert all entities to schemas
 */
export function entitiesToSchemas(entities: YamaEntities): YamaSchemas {
  const schemas: YamaSchemas = {};

  for (const [entityName, entityDef] of Object.entries(entities)) {
    const schemaName = entityDef.apiSchema || entityName;
    schemas[schemaName] = entityToSchema(entityName, entityDef, entities);
  }

  return schemas;
}

/**
 * Merge entity-generated schemas with explicit schemas
 * Explicit schemas take precedence
 */
export function mergeSchemas(
  explicitSchemas: YamaSchemas | undefined,
  entitySchemas: YamaSchemas
): YamaSchemas {
  if (!explicitSchemas) {
    return entitySchemas;
  }

  // Start with entity schemas, then override with explicit schemas
  return {
    ...entitySchemas,
    ...explicitSchemas,
  };
}


