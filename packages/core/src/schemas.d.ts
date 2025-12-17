import { ErrorObject } from "ajv";
import type { ComputedFieldDefinition } from "./entities.js";
export interface SchemaField {
    type?: "uuid" | "string" | "number" | "boolean" | "integer" | "array" | "list" | "object" | string;
    required?: boolean;
    default?: unknown;
    format?: string;
    validator?: string;
    items?: SchemaField;
    properties?: Record<string, SchemaField>;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: unknown[];
    /** @deprecated Use direct type references like type: "User" or type: "User[]" instead */
    $ref?: string;
}
export interface SchemaDefinition {
    table?: string;
    fields: Record<string, SchemaField>;
    computed?: Record<string, ComputedFieldDefinition>;
    variants?: Record<string, import("./variants/types.js").VariantConfig>;
    database?: {
        table?: string;
        indexes?: Array<{
            fields: string[];
            unique?: boolean;
            name?: string;
        }>;
    };
}
export type { ComputedFieldDefinition } from "./entities.js";
export interface YamaSchemas {
    [schemaName: string]: SchemaDefinition;
}
/**
 * Parse schema field definition using new type system
 * Uses TypeParser for all type parsing
 */
export declare function parseSchemaFieldDefinition(fieldName: string, fieldDef: SchemaField | string, availableSchemas?: Set<string>): SchemaField;
/**
 * Normalize a schema definition
 * Parses shorthand field syntax automatically using new type system
 */
export declare function normalizeSchemaDefinition(schemaDef: SchemaDefinition | {
    fields?: Record<string, SchemaField | string>;
    computed?: any;
    variants?: any;
    database?: any;
}): SchemaDefinition;
/**
 * Normalize query/params from schema format to internal format
 * Handles Record<string, SchemaField | string> format (supports shorthand)
 */
export declare function normalizeQueryOrParams(queryOrParams: Record<string, SchemaField | string> | undefined): Record<string, SchemaField> | undefined;
/**
 * Normalize body definition - handles string (schema reference), object with type, or object with fields
 */
export declare function normalizeBodyDefinition(body: string | {
    type?: string;
    fields?: Record<string, SchemaField | string>;
    properties?: Record<string, SchemaField>;
} | undefined): {
    type?: string;
    fields?: Record<string, SchemaField>;
} | undefined;
export interface ValidationResult {
    valid: boolean;
    errors?: ErrorObject[];
    errorMessage?: string;
}
/**
 * Convert Yama schema field to JSON Schema property
 * @param useOpenAPIFormat - If true, use OpenAPI 3.0 format (#/components/schemas/), otherwise use JSON Schema format (#/definitions/)
 */
export declare function fieldToJsonSchema(field: SchemaField, fieldName: string, schemas?: YamaSchemas, visited?: Set<string>, useOpenAPIFormat?: boolean): Record<string, unknown>;
/**
 * Convert Yama schema definition to JSON Schema
 * @param useOpenAPIFormat - If true, use OpenAPI 3.0 format (#/components/schemas/), otherwise use JSON Schema format (#/definitions/)
 */
export declare function schemaToJsonSchema(schemaName: string, schemaDef: SchemaDefinition | {
    fields?: Record<string, SchemaField | string>;
}, schemas?: YamaSchemas, visited?: Set<string>, useOpenAPIFormat?: boolean): Record<string, unknown>;
/**
 * Custom validator function type
 */
export type CustomValidator = (value: unknown, field: SchemaField, data: unknown) => boolean | string | Promise<boolean | string>;
/**
 * Schema validator class
 */
export declare class SchemaValidator {
    private ajv;
    private validators;
    private customValidators;
    constructor();
    /**
     * Register a custom validator function
     */
    registerCustomValidator(name: string, validator: CustomValidator): void;
    /**
     * Get a custom validator by name
     */
    getCustomValidator(name: string): CustomValidator | undefined;
    /**
     * Register schemas and create validators
     */
    registerSchemas(schemas: YamaSchemas): void;
    /**
     * Validate data against a schema
     */
    validate(schemaName: string, data: unknown): Promise<ValidationResult>;
    /**
     * Validate a field value with custom validator if specified
     */
    validateField(fieldName: string, field: SchemaField, value: unknown, data: unknown): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Validate data against a JSON schema directly (without registering as a schema)
     */
    validateSchema(schema: Record<string, unknown>, data: unknown): ValidationResult;
    /**
     * Format validation errors into a readable message
     */
    formatErrors(errors: ErrorObject[]): string;
}
/**
 * Create a new schema validator instance
 */
export declare function createSchemaValidator(): SchemaValidator;
export type AuthProviderType = "jwt" | "api-key" | "basic" | string;
export interface JwtAuthProvider {
    type: "jwt";
    secret: string;
    algorithm?: string;
    issuer?: string;
    audience?: string;
    accessToken?: {
        expiresIn?: string | number;
    };
    refreshToken?: {
        enabled?: boolean;
        expiresIn?: string | number;
    };
}
export interface ApiKeyAuthProvider {
    type: "api-key";
    header: string;
    validate?: (apiKey: string) => Promise<boolean> | boolean;
}
export interface BasicAuthProviderStatic {
    type: "basic";
    mode: "static";
    identifier: string;
    password: string;
}
export interface BasicAuthProviderDatabase {
    type: "basic";
    mode: "database";
    userEntity: string;
    identifierField?: string;
    passwordField?: string;
}
export type BasicAuthProvider = BasicAuthProviderStatic | BasicAuthProviderDatabase;
export interface OAuthAuthProvider {
    type: string;
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
    autoGenerateEndpoints?: boolean;
    [key: string]: unknown;
}
export type AuthProvider = JwtAuthProvider | ApiKeyAuthProvider | BasicAuthProvider | OAuthAuthProvider;
export interface AuthConfig {
    providers: AuthProvider[];
    /**
     * Optional role-to-permission mapping for permission-based authorization
     * Example: { admin: { permissions: ["*"] }, user: { permissions: ["posts:read", "posts:create"] } }
     */
    roles?: Record<string, {
        permissions: string[];
    }>;
}
export interface EndpointAuth {
    required?: boolean;
    roles?: string[];
    /**
     * Required permissions for this endpoint (permission-based authorization)
     * User must have at least one of these permissions (derived from their roles)
     */
    permissions?: string[];
    /**
     * Custom authorization handler function name
     * Handler will be called with authContext and should return boolean or throw error
     */
    handler?: string;
    provider?: string;
}
export type { AuthContext, AuthUser } from "./auth/types.js";
export type RateLimitKeyStrategy = "ip" | "user" | "both";
export type RateLimitStoreType = "memory" | "redis";
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    keyBy?: RateLimitKeyStrategy;
    store?: RateLimitStoreType;
    redis?: {
        url?: string;
        host?: string;
        port?: number;
        password?: string;
        db?: number;
        [key: string]: unknown;
    };
}
export type { ApisConfig } from "./apis/types.js";
//# sourceMappingURL=schemas.d.ts.map