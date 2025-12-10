import { ErrorObject } from "ajv";
export interface SchemaField {
    type?: "string" | "number" | "boolean" | "integer" | "array" | "list" | "object" | string;
    required?: boolean;
    default?: unknown;
    format?: string;
    items?: SchemaField;
    properties?: Record<string, SchemaField>;
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
    /** @deprecated Use direct type references like type: "User" or type: "User[]" instead */
    $ref?: string;
}
export interface SchemaDefinition {
    fields: Record<string, SchemaField>;
}
export interface YamaSchemas {
    [schemaName: string]: SchemaDefinition;
}
/**
 * Normalize a schema from OpenAPI/JSON Schema format to internal format
 * Handles schemas with either:
 * - Internal format: { fields: {...} }
 * - OpenAPI format: { type: "object", properties: {...} }
 */
export declare function normalizeSchemaDefinition(schemaDef: SchemaDefinition | {
    type?: string;
    properties?: Record<string, SchemaField>;
    required?: string[];
}): SchemaDefinition;
/**
 * Normalize query/params from schema format to internal format
 * Handles both:
 * - Schema format: { type?: "object", properties: {...}, required?: [...] }
 *   (type: "object" is optional - if properties exists, it's assumed to be an object)
 * - Internal format: Record<string, SchemaField>
 */
export declare function normalizeQueryOrParams(queryOrParams: Record<string, SchemaField> | {
    type?: string;
    properties?: Record<string, SchemaField>;
    required?: string[];
} | undefined): Record<string, SchemaField> | undefined;
export interface ValidationResult {
    valid: boolean;
    errors?: ErrorObject[];
    errorMessage?: string;
}
/**
 * Convert Yama schema field to JSON Schema property
 */
export declare function fieldToJsonSchema(field: SchemaField, fieldName: string, schemas?: YamaSchemas, visited?: Set<string>): Record<string, unknown>;
/**
 * Convert Yama schema definition to JSON Schema
 */
export declare function schemaToJsonSchema(schemaName: string, schemaDef: SchemaDefinition | {
    type?: string;
    properties?: Record<string, SchemaField>;
    required?: string[];
}, schemas?: YamaSchemas, visited?: Set<string>): Record<string, unknown>;
/**
 * Schema validator class
 */
export declare class SchemaValidator {
    private ajv;
    private validators;
    constructor();
    /**
     * Register schemas and create validators
     */
    registerSchemas(schemas: YamaSchemas): void;
    /**
     * Validate data against a schema
     */
    validate(schemaName: string, data: unknown): ValidationResult;
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
export interface AuthContext {
    authenticated: boolean;
    user?: {
        id?: string;
        email?: string;
        roles?: string[];
        [key: string]: unknown;
    };
    provider?: string;
    token?: string;
}
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
