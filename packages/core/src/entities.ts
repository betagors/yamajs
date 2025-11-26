import type { SchemaField, SchemaDefinition, YamaSchemas } from "./schemas.js";

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
 * CRUD configuration for auto-generating endpoints
 */
export interface CrudConfig {
  /**
   * Enable CRUD endpoint generation for this entity
   * Can be:
   * - `true` - Generate all CRUD endpoints (GET, POST, PUT, PATCH, DELETE)
   * - `false` - Don't generate CRUD endpoints
   * - Array of methods to generate (e.g., ["GET", "POST"])
   * - Object with method-specific config:
   *   - Individual methods: { "GET": { auth: { required: false } } }
   *   - Method groups: { "read": { auth: { required: false } }, "write": { auth: { required: true, roles: ["admin"] } } }
   * 
   * Method groups available:
   * - `read` - GET methods
   * - `write` or `mutate` - POST, PUT, PATCH, DELETE methods
   * - `create` - POST method
   * - `update` - PUT, PATCH methods
   * - `delete` - DELETE method
   */
  enabled?: boolean | string[] | Record<string, { auth?: { required?: boolean; roles?: string[] }; path?: string; inputType?: string; responseType?: string }>;
  /**
   * Base path for CRUD endpoints (default: pluralized entity name in lowercase)
   * e.g., "Example" -> "/examples"
   */
  path?: string;
  /**
   * Auth configuration applied to all CRUD endpoints (can be overridden per method or method group)
   */
  auth?: {
    required?: boolean;
    roles?: string[];
    permissions?: string[];
    handler?: string;
  };
  /**
   * Custom input types per HTTP method
   * Overrides the default generated input schemas (e.g., CreateEntityInput, UpdateEntityInput)
   * Example: { POST: "CustomCreateInput", PATCH: "UpdateStatusInput" }
   */
  inputTypes?: Record<string, string>;
  /**
   * Custom response types per HTTP method
   * Use GET_LIST for list endpoints, GET_ONE for single item endpoints
   * Example: { GET_LIST: "TodoSummary", GET_ONE: "TodoDetail", POST: "Todo" }
   */
  responseTypes?: Record<string, string>;
  /**
   * Search configuration for CRUD list endpoints
   * 
   * Simplified syntax options:
   * - `true` - Enable search with smart defaults (all string/text fields, contains mode)
   * - `["field1", "field2"]` - Enable search on specific fields only
   * - `{ fields: [...], mode: "starts", fullText: true }` - Full configuration
   * - `false` - Explicitly disable search (if entity has searchable fields)
   * 
   * If not specified, search is automatically enabled if entity has string/text fields
   */
  search?: boolean | string[] | {
    /**
     * Fields that can be searched (default: all string/text fields)
     * Can be array of field names or true to enable all searchable fields
     */
    fields?: string[] | true;
    /**
     * Search mode: "contains" (default), "starts", "ends", "exact"
     */
    mode?: "contains" | "starts" | "ends" | "exact";
    /**
     * Enable full-text search across multiple fields with a single query parameter
     * Default: true (enabled automatically)
     */
    fullText?: boolean;
  };
  /**
   * Pagination configuration for CRUD list endpoints
   * 
   * Supports all pagination types: offset, page, cursor
   * Default: offset pagination with limit/offset query params
   * 
   * Examples:
   * - `pagination: true` - Enable offset pagination (default)
   * - `pagination: { type: "page" }` - Use page-based pagination
   * - `pagination: { type: "cursor", cursorField: "id" }` - Use cursor pagination
   */
  pagination?: import("./pagination/types.js").PaginationConfig;
}

/**
 * Entity definition
 */
export interface EntityDefinition {
  table: string; // Database table name
  fields: Record<string, EntityField>;
  indexes?: EntityIndex[];
  apiSchema?: string; // Optional custom API schema name (default: entity name)
  crud?: boolean | CrudConfig; // Optional CRUD endpoint generation
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


