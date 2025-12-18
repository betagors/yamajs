import type { SchemaField, SchemaDefinition, YamaSchemas } from "./schemas.js";
import { TypeParser } from "./types/index.js";
import type { FieldType } from "./types/index.js";
import { normalizeConfig } from "./config-normalizer.js";

/**
 * Entity field types supported by Yama
 * Supports all new type system types
 */
export type EntityFieldType = 
  | "uuid" | "string" | "text" | "email" | "url" | "phone" | "slug"
  | "number" | "integer" | "int" | "int8" | "int16" | "int32" | "int64" | "bigint" | "uint"
  | "decimal" | "money" | "float" | "double"
  | "boolean"
  | "date" | "time" | "timestamp" | "timestamptz" | "timestamplocal" | "datetime" | "datetimetz" | "datetimelocal" | "interval" | "duration"
  | "json" | "jsonb" | "binary" | "base64" | "enum";

/**
 * Entity field definition - shorthand syntax is the default
 * Use object syntax only for advanced configuration (dbColumn, dbType, etc.)
 */
export type EntityFieldDefinition = string | EntityField;

/**
 * Entity field definition (parsed/normalized)
 * Shorthand strings are parsed into this format
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
  unique?: boolean; // Unique constraint
  
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
  
  // New type system properties
  precision?: number;
  scale?: number;
  currency?: string;
  length?: number;
  readonly?: boolean;
  writeOnly?: boolean;
  sensitive?: boolean;
  autoUpdate?: boolean;
  
  // Inline relation marker (when field is an entity reference)
  _isInlineRelation?: boolean;
  _inlineRelation?: {
    entity: string;
    relationType: "belongsTo" | "hasMany" | "hasOne" | "manyToMany";
    cascade?: boolean;
    through?: string;
    timestamps?: boolean;
  };
  // Inline nested type marker (when field is an object with fields)
  _isInlineNestedType?: boolean;
  _inlineNestedFields?: Record<string, EntityFieldDefinition>;
}

/**
 * Relation type definitions
 */
export type RelationType = 
  | `hasMany(${string})` 
  | `belongsTo(${string})` 
  | `hasOne(${string})` 
  | `manyToMany(${string})`;

/**
 * Relation definition
 * Can be shorthand (e.g., "hasMany(Post)") or full object
 */
export type RelationDefinition = string | {
  type: "hasMany" | "belongsTo" | "hasOne" | "manyToMany";
  entity: string;
  foreignKey?: string; // For belongsTo/hasMany
  through?: string; // For manyToMany (junction table)
  localKey?: string; // For manyToMany
  foreignKeyTarget?: string; // For manyToMany
  onDelete?: "cascade" | "setNull" | "restrict" | "noAction"; // For belongsTo/hasMany
};

/**
 * Validation rule
 * Can be a string (e.g., "email", "unique", "minLength(2)") or an object
 */
export type ValidationRule = string | {
  type: string;
  value?: unknown;
  message?: string;
};

/**
 * Computed field definition
 * Can be a string expression or an object with more options
 */
export type ComputedFieldDefinition = string | {
  expression: string;
  type?: EntityFieldType;
  dependsOn?: string[]; // Fields this computed field depends on
};

/**
 * Entity hooks
 */
export interface EntityHooks {
  beforeCreate?: string; // Path to handler file
  afterCreate?: string;
  beforeUpdate?: string;
  afterUpdate?: string;
  beforeDelete?: string;
  afterDelete?: string;
  beforeSave?: string;
  afterSave?: string;
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
 * Entity definition (unified with schemas)
 * Supports new schema-first syntax with variants, computed fields, etc.
 * EntityDefinition and SchemaDefinition are compatible - both represent the same concept
 */
export interface EntityDefinition {
  // Source schema/entity (for derived schemas)
  source?: string; // Source entity/schema name to inherit from
  
  // Include only specific fields from source
  include?: string[]; // Field names to include (used with source)
  
  // Database config (can be at top level or in database:)
  table?: string; // Database table name
  fields?: Record<string, EntityFieldDefinition>; // Supports new concise type syntax, inline nested types
  relations?: Record<string, RelationDefinition>; // Dedicated relations section
  validations?: Record<string, ValidationRule[]>; // Declarative validations
  computed?: Record<string, ComputedFieldDefinition>; // Computed fields
  variants?: Record<string, import("./variants/types.js").VariantConfig>; // Schema variants for DTOs
  hooks?: EntityHooks; // Lifecycle hooks
  indexes?: EntityIndex[]; // Database indexes
  softDelete?: boolean; // Enable soft deletes
  apiSchema?: string; // Optional custom API schema name (default: entity name)
  crud?: boolean | CrudConfig; // Optional CRUD endpoint generation
  database?: {
    table?: string; // Override table name
    indexes?: EntityIndex[]; // Database-specific indexes
  } | string; // Shorthand: just table name
}

/**
 * Collection of entity definitions
 * 
 * In the schema-first approach, entities and schemas are unified.
 * Use normalizeSchemas() to handle both schemas: and entities: keys in config.
 * Prefer using 'schemas:' in your yama.yaml - 'entities:' is supported for backward compatibility.
 */
export interface YamaEntities {
  [entityName: string]: EntityDefinition;
}

// Re-export types from operations and policies for convenience
export type { YamaOperations } from "./operations/types.js";
export type { YamaPolicies } from "./policies/types.js";

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
 * Parse field definition using new type system
 * Supports inline relations (e.g., "User!", "Post[]", "Tag[] through:post_tags")
 * Uses TypeParser for all type parsing
 */
export function parseFieldDefinition(
  fieldName: string,
  fieldDef: EntityFieldDefinition,
  availableEntities?: Set<string>
): EntityField {
  // Fast path: already parsed
  if (typeof fieldDef !== "string") {
    // Handle inline nested type (object with fields property)
    if (typeof fieldDef === "object" && fieldDef !== null && !Array.isArray(fieldDef) && "fields" in fieldDef) {
      // This is an inline nested type - mark it as such
      return {
        type: "object",
        _isInlineNestedType: true,
        _inlineNestedFields: fieldDef.fields as Record<string, EntityFieldDefinition>,
      } as any;
    }
    
    // If it's an object, convert using TypeParser
    if (typeof fieldDef === "object" && fieldDef !== null && !Array.isArray(fieldDef)) {
      const parsedType = TypeParser.parseExpanded(fieldDef as any);
      return {
        type: parsedType.type as EntityFieldType,
        required: !parsedType.nullable,
        nullable: parsedType.nullable,
        unique: parsedType.unique,
        index: parsedType.indexed,
        generated: parsedType.generated,
        default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
        minLength: parsedType.minLength,
        maxLength: parsedType.maxLength,
        min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
        max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
        pattern: parsedType.pattern,
        enum: parsedType.enumValues,
        precision: parsedType.precision,
        scale: parsedType.scale,
        currency: parsedType.currency,
        length: parsedType.length,
        readonly: parsedType.readonly,
        writeOnly: parsedType.writeOnly,
        sensitive: parsedType.sensitive,
        autoUpdate: parsedType.autoUpdate,
      };
    }
    return fieldDef;
  }

  const str = fieldDef.trim();

  // Extract relation config (through:, cascade, timestamps)
  const relationConfig: Record<string, string | boolean> = {};
  const parts = str.split(/\s+/);
  let typeStr = parts[0];
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === "cascade") {
      relationConfig.cascade = true;
    } else if (part.startsWith("through:")) {
      relationConfig.through = part.substring(8);
    } else if (part === "timestamps:true" || part === "timestamps") {
      relationConfig.timestamps = true;
    }
  }

  // Check if this is an entity reference (capitalized name)
  // Remove array and required/optional markers for entity check
  let entityCheckStr = typeStr;
  if (entityCheckStr.endsWith("[]")) {
    entityCheckStr = entityCheckStr.slice(0, -2);
  }
  if (entityCheckStr.endsWith("!") || entityCheckStr.endsWith("?")) {
    entityCheckStr = entityCheckStr.slice(0, -1);
  }

  const isEntityReference = /^[A-Z][a-zA-Z0-9]*$/.test(entityCheckStr) && 
    (availableEntities?.has(entityCheckStr) ?? true);

  if (isEntityReference) {
    // This is an inline relation - extract relation info from string
    // Parse just enough to get array/nullable info
    const hasArray = str.includes("[]");
    const isRequired = str.endsWith("!") || (!str.endsWith("?") && !str.includes("?"));
    const isNullable = str.endsWith("?") || (!isRequired);
    
    const field: EntityField = {
      type: "string",
      _isInlineRelation: true,
    };

    // Determine relation type based on syntax
    let relationType: "belongsTo" | "hasMany" | "hasOne" | "manyToMany";
    if (hasArray) {
      relationType = relationConfig.through ? "manyToMany" : "hasMany";
    } else if (isNullable && !isRequired) {
      relationType = "hasOne";
    } else {
      relationType = "belongsTo";
    }

    field._inlineRelation = {
      entity: entityCheckStr,
      relationType,
      ...(relationConfig.cascade && { cascade: true }),
      ...(relationConfig.through && { through: relationConfig.through as string }),
      ...(relationConfig.timestamps && { timestamps: true }),
    };

    return field;
  }

  // Use TypeParser for all type parsing
  const parsedType = TypeParser.parse(str);
  
  // Convert FieldType to EntityField
  const field: EntityField = {
    type: parsedType.type as EntityFieldType,
    required: !parsedType.nullable,
    nullable: parsedType.nullable,
    unique: parsedType.unique,
    index: parsedType.indexed,
    generated: parsedType.generated,
    default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
    minLength: parsedType.minLength,
    maxLength: parsedType.maxLength,
    min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
    max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
    pattern: parsedType.pattern,
    enum: parsedType.enumValues,
  };

  // Copy precision/scale for decimal types
  if (parsedType.precision !== undefined) {
    (field as any).precision = parsedType.precision;
  }
  if (parsedType.scale !== undefined) {
    (field as any).scale = parsedType.scale;
  }
  if (parsedType.currency) {
    (field as any).currency = parsedType.currency;
  }
  if (parsedType.length) {
    (field as any).length = parsedType.length;
  }

  return field;
}

/**
 * Parse relation shorthand syntax - optimized for shorthand-first approach
 */
export function parseRelationDefinition(
  relationDef: RelationDefinition
): {
  type: "hasMany" | "belongsTo" | "hasOne" | "manyToMany";
  entity: string;
  foreignKey?: string;
  through?: string;
  localKey?: string;
  foreignKeyTarget?: string;
  onDelete?: "cascade" | "setNull" | "restrict" | "noAction";
} {
  // Fast path: already parsed
  if (typeof relationDef !== "string") {
    return relationDef;
  }

  // Optimized regex for common patterns
  const match = relationDef.match(/^(hasMany|belongsTo|hasOne|manyToMany)\((.+)\)$/);
  if (!match) {
    throw new Error(`Invalid relation syntax: ${relationDef}. Use: hasMany(Entity), belongsTo(Entity), hasOne(Entity), or manyToMany(Entity)`);
  }

  return {
    type: match[1] as "hasMany" | "belongsTo" | "hasOne" | "manyToMany",
    entity: match[2].trim(),
  };
}

/**
 * Normalize entity definition - optimized parser for shorthand-first syntax
 * Parses fields and relations on-demand, caching results
 * Extracts inline relations from fields and auto-generates foreign keys
 * Handles source inheritance and include filtering
 */
export function normalizeEntityDefinition(
  entityName: string,
  entityDef: EntityDefinition,
  allEntities?: YamaEntities
): Omit<EntityDefinition, "fields" | "relations"> & {
  fields: Record<string, EntityField>;
  relations?: Record<string, ReturnType<typeof parseRelationDefinition>>;
} {
  // Handle database shorthand (string)
  const dbConfig = typeof entityDef.database === "string"
    ? { table: entityDef.database }
    : entityDef.database;
  
  // Build normalized structure - only copy what we need
  const normalized: Omit<EntityDefinition, "fields" | "relations"> & {
    fields: Record<string, EntityField>;
    relations?: Record<string, ReturnType<typeof parseRelationDefinition>>;
  } = {
    table: dbConfig?.table || entityDef.table || entityName.toLowerCase() + 's',
    indexes: entityDef.indexes || dbConfig?.indexes,
    apiSchema: entityDef.apiSchema,
    crud: entityDef.crud,
    validations: entityDef.validations,
    computed: entityDef.computed,
    variants: entityDef.variants,
    hooks: entityDef.hooks,
    softDelete: entityDef.softDelete,
    source: entityDef.source,
    include: entityDef.include,
    fields: {},
  };

  // Build set of available entity names for validation
  const availableEntities = allEntities && typeof allEntities === 'object' && allEntities !== null
    ? new Set(Object.keys(allEntities))
    : undefined;

  // Handle source inheritance
  let baseFields: Record<string, EntityFieldDefinition> = {};
  if (entityDef.source && allEntities) {
    const sourceEntity = allEntities[entityDef.source];
    if (sourceEntity) {
      // Normalize source entity to get its fields
      const normalizedSource = normalizeEntityDefinition(entityDef.source, sourceEntity, allEntities);
      
      // If include is specified, only include those fields
      if (entityDef.include && Array.isArray(entityDef.include)) {
        for (const fieldName of entityDef.include) {
          if (normalizedSource.fields[fieldName]) {
            // Convert EntityField back to EntityFieldDefinition for merging
            // This is a simplified conversion - in practice, we'd need to preserve the original definition
            baseFields[fieldName] = normalizedSource.fields[fieldName] as any;
          }
        }
      } else {
        // Include all fields from source
        for (const [fieldName, field] of Object.entries(normalizedSource.fields)) {
          baseFields[fieldName] = field as any;
        }
      }
    }
  }

  // Merge base fields with entity's own fields (entity fields override source fields)
  const mergedFields = {
    ...baseFields,
    ...(entityDef.fields || {}),
  };

  // Parse fields and extract inline relations
  if (Object.keys(mergedFields).length === 0) {
    return normalized;
  }
  const fieldEntries = Object.entries(mergedFields);
  const inlineRelations: Record<string, ReturnType<typeof parseRelationDefinition>> = {};
  
  for (let i = 0; i < fieldEntries.length; i++) {
    const [fieldName, fieldDef] = fieldEntries[i];
    const parsedField = parseFieldDefinition(fieldName, fieldDef, availableEntities);
    
    // Check if this is an inline relation
    if (parsedField._isInlineRelation && parsedField._inlineRelation) {
      const inlineRel = parsedField._inlineRelation;
      
      // Convert inline relation to normalized relation format
      const normalizedRelation: ReturnType<typeof parseRelationDefinition> = {
        type: inlineRel.relationType,
        entity: inlineRel.entity,
      };

      // Add relation-specific config
      if (inlineRel.through) {
        normalizedRelation.through = inlineRel.through;
      }
      if (inlineRel.cascade && inlineRel.relationType === "belongsTo") {
        // For belongsTo, cascade means onDelete: cascade
        normalizedRelation.onDelete = "cascade";
      }

      // Auto-generate foreign key for belongsTo relations
      if (inlineRel.relationType === "belongsTo") {
        const foreignKeyName = `${fieldName}Id`;
        
        // Only auto-generate if foreign key doesn't already exist
        if (!entityDef.fields || !entityDef.fields[foreignKeyName]) {
          normalized.fields[foreignKeyName] = {
            type: "uuid",
            required: !parsedField.nullable,
            nullable: parsedField.nullable,
            index: true, // Auto-index foreign keys
          };
          normalizedRelation.foreignKey = foreignKeyName;
        } else {
          // Foreign key exists, use it
          const fkField = parseFieldDefinition(foreignKeyName, entityDef.fields[foreignKeyName], availableEntities);
          normalized.fields[foreignKeyName] = fkField;
          normalizedRelation.foreignKey = foreignKeyName;
        }
      }

      // Store inline relation
      inlineRelations[fieldName] = normalizedRelation;
    } else {
      // Regular field
      normalized.fields[fieldName] = parsedField;
    }
  }

  // Parse explicit relations if present
  const explicitRelations: Record<string, ReturnType<typeof parseRelationDefinition>> = {};
  if (entityDef.relations && typeof entityDef.relations === 'object' && entityDef.relations !== null) {
    const relationEntries = Object.entries(entityDef.relations);
    for (let i = 0; i < relationEntries.length; i++) {
      const [relationName, relationDef] = relationEntries[i];
      explicitRelations[relationName] = parseRelationDefinition(relationDef);
    }
  }

  // Merge relations: explicit takes precedence over inline
  if (Object.keys(inlineRelations).length > 0 || Object.keys(explicitRelations).length > 0) {
    normalized.relations = {
      ...inlineRelations,
      ...explicitRelations, // Explicit relations override inline ones
    };
  }

  return normalized;
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
  // Map all new types to JSON Schema types
  if (entityType === "uuid" || entityType === "string" || entityType === "text" || 
      entityType === "email" || entityType === "url" || entityType === "phone" || 
      entityType === "slug" || entityType === "base64") {
    return "string";
  }
  if (entityType === "number" || entityType === "decimal" || entityType === "money" || 
      entityType === "float" || entityType === "double") {
    return "number";
  }
  if (entityType === "integer" || entityType === "int" || entityType === "int8" || 
      entityType === "int16" || entityType === "int32" || entityType === "int64" || 
      entityType === "bigint" || entityType === "uint") {
    return "integer";
  }
  if (entityType === "boolean") {
    return "boolean";
  }
  if (entityType === "timestamp" || entityType === "timestamptz" || 
      entityType === "timestamplocal" || entityType === "datetime" || 
      entityType === "datetimetz" || entityType === "datetimelocal" || 
      entityType === "date" || entityType === "time" || entityType === "interval" || 
      entityType === "duration") {
    return "string";
  }
  if (entityType === "json" || entityType === "jsonb") {
    return "object";
  }
  if (entityType === "enum") {
    return "string";
  }
  if (entityType === "binary") {
    return "string"; // Base64 encoded
  }
  return "string";
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

  // Add format for date/time types
  if (entityField.type === "timestamp" || entityField.type === "timestamptz" || 
      entityField.type === "timestamplocal" || entityField.type === "datetime" || 
      entityField.type === "datetimetz" || entityField.type === "datetimelocal") {
    schemaField.format = entityField.apiFormat || "date-time";
  } else if (entityField.type === "date") {
    schemaField.format = "date";
  } else if (entityField.type === "time") {
    schemaField.format = "time";
  } else if (entityField.type === "email") {
    schemaField.format = "email";
  } else if (entityField.type === "url") {
    schemaField.format = "uri";
  }

  // Add validation rules
  if (entityField.minLength !== undefined) {
    schemaField.minLength = entityField.minLength;
  }
  if (entityField.maxLength !== undefined) {
    schemaField.maxLength = entityField.maxLength;
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
 * Optimized - normalizes once and processes fields efficiently
 */
export function entityToSchema(
  entityName: string,
  entityDef: EntityDefinition,
  entities?: YamaEntities
): SchemaDefinition {
  // Normalize once - all fields become EntityField objects
  const normalized = normalizeEntityDefinition(entityName, entityDef, entities);
  const schemaFields: Record<string, SchemaField> = {};
  
  if (!normalized.fields || typeof normalized.fields !== 'object' || normalized.fields === null) {
    return { fields: schemaFields };
  }
  
  const fieldEntries = Object.entries(normalized.fields);

  // Process fields - optimized loop
  for (let i = 0; i < fieldEntries.length; i++) {
    const [fieldName, entityField] = fieldEntries[i];
    // Skip inline relations - they're handled via foreign keys, not as direct fields
    if (entityField._isInlineRelation) {
      continue;
    }
    const result = entityFieldToSchemaField(fieldName, entityField);
    if (result) {
      schemaFields[result.apiFieldName] = result.schemaField;
    }
  }

  // Computed fields are runtime-only, not in schema
  // They would be resolved dynamically when fetching entities

  return { fields: schemaFields };
}

/**
 * Normalize config to use schemas (unified entities/schemas)
 * Uses config-normalizer for unified handling
 */
export function normalizeSchemas(config: { schemas?: YamaEntities | YamaSchemas; entities?: YamaEntities | YamaSchemas }): YamaEntities | undefined {
  const normalized = normalizeConfig(config);
  return normalized.schemas as YamaEntities | undefined;
}

/**
 * Convert entities to API schemas (SchemaDefinition format for validation)
 * This converts EntityDefinition to SchemaDefinition format
 */
export function entitiesToSchemas(entities: YamaEntities): import("./schemas.js").YamaSchemas {
  const schemas: import("./schemas.js").YamaSchemas = {};
  if (!entities || typeof entities !== 'object' || entities === null) {
    return schemas;
  }
  const entityEntries = Object.entries(entities);

  // Process all entities in one pass
  for (let i = 0; i < entityEntries.length; i++) {
    const [entityName, entityDef] = entityEntries[i];
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
  explicitSchemas: YamaSchemas | undefined | null,
  entitySchemas: YamaSchemas
): YamaSchemas {
  // Handle null or undefined explicitSchemas
  if (!explicitSchemas || typeof explicitSchemas !== 'object' || explicitSchemas === null) {
    return entitySchemas && typeof entitySchemas === 'object' && entitySchemas !== null ? entitySchemas : {};
  }

  // Ensure entitySchemas is an object before spreading
  const normalizedEntitySchemas = entitySchemas && typeof entitySchemas === 'object' && entitySchemas !== null ? entitySchemas : {};

  // Start with entity schemas, then override with explicit schemas
  return {
    ...normalizedEntitySchemas,
    ...explicitSchemas,
  };
}


