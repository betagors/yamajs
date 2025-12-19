/**
 * Yama Plugin Directives System - Type Definitions
 *
 * Directives are annotations on fields and schemas that modify behavior.
 * Examples:
 *   email: string! @unique @index @mock("faker.internet.email")
 *
 * Directives execute left-to-right as a pipeline.
 */

import type { FieldType } from '../types/types.js';

// ============================================================================
// Parsed Directive Types
// ============================================================================

/**
 * Parsed directive from field type string
 */
export interface ParsedDirective {
    /** Directive name including @ (e.g., "@unique", "@searchable") */
    name: string;

    /** Parsed arguments */
    args: DirectiveArgs;

    /** Original string for error messages */
    raw: string;
}

/**
 * Directive arguments
 *
 * Can be:
 * - Positional: @mock("faker.email") → { _value: "faker.email" }
 * - Named: @encrypted(algorithm: "argon2", cost: 12) → { algorithm: "argon2", cost: 12 }
 * - Boolean: @searchable → { enabled: true }, @searchable(false) → { enabled: false }
 * - Array: @enum(["a", "b"]) → { values: ["a", "b"] }
 */
export interface DirectiveArgs {
    /** Positional value for single-argument directives */
    _value?: unknown;

    /** Boolean shorthand (default true) */
    enabled?: boolean;

    /** Array values */
    values?: unknown[];

    /** Any named arguments */
    [key: string]: unknown;
}

// ============================================================================
// Directive Definition Types
// ============================================================================

/**
 * Where a directive can be used
 */
export type DirectiveTarget = 'field' | 'schema' | 'both';

/**
 * Directive definition registered by plugins
 */
export interface DirectiveDefinition {
    /** Directive name including @ (e.g., "@searchable") */
    name: string;

    /** Plugin that registered this directive */
    pluginName: string;

    /** Where can this directive be used? */
    targets: DirectiveTarget[];

    /** JSON Schema for argument validation */
    argsSchema?: Record<string, unknown>;

    /** Human-readable description */
    description?: string;

    /**
     * Field-level hook - called when directive is applied to a field
     * Can modify the field type or attach metadata
     */
    onField?(context: DirectiveFieldContext): void | Promise<void>;

    /**
     * Schema-level hook - called when directive is applied to a schema
     */
    onSchema?(context: DirectiveSchemaContext): void | Promise<void>;

    /**
     * Transform hook - called during request processing (pipeline order)
     * Used to transform field values (e.g., @hash, @encrypt)
     */
    transform?(
        value: unknown,
        args: DirectiveArgs,
        context: DirectiveTransformContext
    ): unknown | Promise<unknown>;

    /**
     * Validate hook - called during validation
     * Return true if valid, or error message string if invalid
     */
    validate?(
        value: unknown,
        args: DirectiveArgs,
        context: DirectiveValidateContext
    ): boolean | string | Promise<boolean | string>;
}

// ============================================================================
// Directive Context Types
// ============================================================================

/**
 * Context provided to field-level directive hooks
 */
export interface DirectiveFieldContext {
    /** Field name being processed */
    fieldName: string;

    /** Parsed field type (can be modified) */
    fieldType: FieldType;

    /** Name of the schema this field belongs to */
    schemaName: string;

    /** Directive arguments */
    args: DirectiveArgs;

    /**
     * Metadata object - plugins can attach data here
     * This persists through the field lifecycle
     */
    meta: Record<string, unknown>;

    /**
     * Access the full schema definition (read-only)
     */
    getSchema(): Record<string, unknown>;
}

/**
 * Context provided to schema-level directive hooks
 */
export interface DirectiveSchemaContext {
    /** Schema name */
    schemaName: string;

    /** Full schema definition */
    schema: Record<string, unknown>;

    /** Directive arguments */
    args: DirectiveArgs;

    /**
     * Metadata object - plugins can attach data here
     */
    meta: Record<string, unknown>;
}

/**
 * Context provided to transform hooks during request processing
 */
export interface DirectiveTransformContext {
    /** Field name being transformed */
    fieldName: string;

    /** Schema name */
    schemaName: string;

    /** Current operation type */
    operation: 'create' | 'update' | 'read';

    /** Full request data (read-only) */
    requestData: Record<string, unknown>;

    /** HTTP request object (if available) */
    request?: unknown;

    /** Logger instance */
    logger: {
        debug(message: string, ...args: unknown[]): void;
        info(message: string, ...args: unknown[]): void;
        warn(message: string, ...args: unknown[]): void;
        error(message: string, ...args: unknown[]): void;
    };
}

/**
 * Context provided to validation hooks
 */
export interface DirectiveValidateContext {
    /** Field name being validated */
    fieldName: string;

    /** Schema name */
    schemaName: string;

    /** Current operation type */
    operation: 'create' | 'update';

    /** Full request data for cross-field validation */
    requestData: Record<string, unknown>;
}

// ============================================================================
// Plugin Schema Options Types (for $$ block)
// ============================================================================

/**
 * Schema-level plugin configuration (from $$ block in schema)
 *
 * Example:
 * ```yaml
 * schemas:
 *   Post:
 *     fields:
 *       title: string!
 *     $$:
 *       meilisearch:
 *         index: true
 *         filterable: ["published"]
 * ```
 */
export interface PluginSchemaConfig {
    [pluginName: string]: Record<string, unknown>;
}

/**
 * JSON Schema definition for plugin's schema options
 */
export interface PluginSchemaOptionsDefinition {
    /** Always 'object' for schema options */
    type: 'object';

    /** Property definitions */
    properties: Record<string, unknown>;

    /** Required properties */
    required?: string[];

    /** Additional properties allowed */
    additionalProperties?: boolean;
}

// ============================================================================
// Schema with Plugin Config
// ============================================================================

/**
 * Schema definition with parsed plugin configurations
 */
export interface SchemaWithPluginConfig {
    /** Schema name */
    name: string;

    /** Field definitions with parsed directives */
    fields: Record<string, FieldWithDirectives>;

    /** Plugin configurations from $$ block */
    pluginConfigs?: PluginSchemaConfig;

    /** Computed fields */
    computed?: Record<string, unknown>;

    /** Database configuration */
    database?: Record<string, unknown>;
}

/**
 * Field definition with parsed directives
 */
export interface FieldWithDirectives {
    /** Parsed field type */
    type: FieldType;

    /** Directives applied to this field (in order) */
    directives: ParsedDirective[];

    /** Metadata attached by directive hooks */
    meta: Record<string, unknown>;
}

// ============================================================================
// Directive Registry Types
// ============================================================================

/**
 * Result of directive validation
 */
export interface DirectiveValidationResult {
    /** Whether the directive usage is valid */
    valid: boolean;

    /** Validation errors */
    errors?: string[];

    /** Validation warnings (non-fatal) */
    warnings?: string[];
}

/**
 * Options for directive execution
 */
export interface DirectiveExecutionOptions {
    /** Stop on first error */
    failFast?: boolean;

    /** Skip unknown directives instead of erroring */
    skipUnknown?: boolean;

    /** Logger for execution messages */
    logger?: {
        debug(message: string, ...args: unknown[]): void;
        info(message: string, ...args: unknown[]): void;
        warn(message: string, ...args: unknown[]): void;
        error(message: string, ...args: unknown[]): void;
    };
}
