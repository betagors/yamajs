import type { SchemaDefinition, YamaSchemas } from "./schemas.js";
/**
 * Entity field types supported by Yama
 */
export type EntityFieldType = "uuid" | "string" | "number" | "boolean" | "timestamp" | "text" | "jsonb" | "integer";
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
    dbType?: string;
    dbColumn?: string;
    primary?: boolean;
    generated?: boolean;
    nullable?: boolean;
    default?: unknown;
    index?: boolean;
    unique?: boolean;
    api?: string | false;
    apiFormat?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
    _isInlineRelation?: boolean;
    _inlineRelation?: {
        entity: string;
        relationType: "belongsTo" | "hasMany" | "hasOne" | "manyToMany";
        cascade?: boolean;
        through?: string;
        timestamps?: boolean;
    };
}
/**
 * Relation type definitions
 */
export type RelationType = `hasMany(${string})` | `belongsTo(${string})` | `hasOne(${string})` | `manyToMany(${string})`;
/**
 * Relation definition
 * Can be shorthand (e.g., "hasMany(Post)") or full object
 */
export type RelationDefinition = string | {
    type: "hasMany" | "belongsTo" | "hasOne" | "manyToMany";
    entity: string;
    foreignKey?: string;
    through?: string;
    localKey?: string;
    foreignKeyTarget?: string;
    onDelete?: "cascade" | "setNull" | "restrict" | "noAction";
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
    dependsOn?: string[];
};
/**
 * Entity hooks
 */
export interface EntityHooks {
    beforeCreate?: string;
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
    enabled?: boolean | string[] | Record<string, {
        auth?: {
            required?: boolean;
            roles?: string[];
        };
        path?: string;
        inputType?: string;
        responseType?: string;
    }>;
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
 * Supports both new syntax (with relations, validations, computed, hooks) and legacy syntax
 */
export interface EntityDefinition {
    table: string;
    fields: Record<string, EntityFieldDefinition>;
    relations?: Record<string, RelationDefinition>;
    validations?: Record<string, ValidationRule[]>;
    computed?: Record<string, ComputedFieldDefinition>;
    hooks?: EntityHooks;
    indexes?: EntityIndex[];
    softDelete?: boolean;
    apiSchema?: string;
    crud?: boolean | CrudConfig;
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
    options?: Record<string, unknown>;
}
/**
 * HTTP server configuration
 */
export interface ServerConfig {
    engine?: "fastify";
    options?: Record<string, unknown>;
}
/**
 * Parse shorthand field syntax (e.g., "string!", "string?", "enum[user, admin]")
 * Also supports inline relations (e.g., "User!", "Post[]", "Tag[] through:post_tags")
 * and inline constraints (e.g., "string! unique", "string! indexed")
 * Optimized parser - assumes shorthand syntax by default
 */
export declare function parseFieldDefinition(fieldName: string, fieldDef: EntityFieldDefinition, availableEntities?: Set<string>): EntityField;
/**
 * Parse relation shorthand syntax - optimized for shorthand-first approach
 */
export declare function parseRelationDefinition(relationDef: RelationDefinition): {
    type: "hasMany" | "belongsTo" | "hasOne" | "manyToMany";
    entity: string;
    foreignKey?: string;
    through?: string;
    localKey?: string;
    foreignKeyTarget?: string;
    onDelete?: "cascade" | "setNull" | "restrict" | "noAction";
};
/**
 * Normalize entity definition - optimized parser for shorthand-first syntax
 * Parses fields and relations on-demand, caching results
 * Extracts inline relations from fields and auto-generates foreign keys
 */
export declare function normalizeEntityDefinition(entityName: string, entityDef: EntityDefinition, allEntities?: YamaEntities): Omit<EntityDefinition, "fields" | "relations"> & {
    fields: Record<string, EntityField>;
    relations?: Record<string, ReturnType<typeof parseRelationDefinition>>;
};
/**
 * Convert entity definition to API schema definition
 * Optimized - normalizes once and processes fields efficiently
 */
export declare function entityToSchema(entityName: string, entityDef: EntityDefinition, entities?: YamaEntities): SchemaDefinition;
/**
 * Convert all entities to schemas - optimized batch processing
 */
export declare function entitiesToSchemas(entities: YamaEntities): YamaSchemas;
/**
 * Merge entity-generated schemas with explicit schemas
 * Explicit schemas take precedence
 */
export declare function mergeSchemas(explicitSchemas: YamaSchemas | undefined | null, entitySchemas: YamaSchemas): YamaSchemas;
