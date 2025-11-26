import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import addFormats from "ajv-formats";

// Type definitions for YAML schema structure
export interface SchemaField {
  type?: "string" | "number" | "boolean" | "integer" | "array" | "list" | "object";
  required?: boolean;
  default?: unknown;
  format?: string;
  items?: SchemaField; // For array/list types
  properties?: Record<string, SchemaField>; // For object types
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  $ref?: string; // Reference to another schema name
}

/**
 * Normalize type: convert "list" to "array" for internal processing
 */
function normalizeType(type: string | undefined): string | undefined {
  return type === "list" ? "array" : type;
}

export interface SchemaDefinition {
  fields: Record<string, SchemaField>;
}

export interface YamaSchemas {
  [schemaName: string]: SchemaDefinition;
}

// Validation error result
export interface ValidationResult {
  valid: boolean;
  errors?: ErrorObject[];
  errorMessage?: string;
}

/**
 * Convert Yama schema field to JSON Schema property
 */
export function fieldToJsonSchema(
  field: SchemaField,
  fieldName: string,
  schemas?: YamaSchemas,
  visited: Set<string> = new Set()
): Record<string, unknown> {
  // Handle schema references
  if (field.$ref) {
    if (visited.has(field.$ref)) {
      throw new Error(`Circular reference detected: ${field.$ref}`);
    }

    if (!schemas || !schemas[field.$ref]) {
      throw new Error(`Schema reference "${field.$ref}" not found`);
    }

    // Recursively convert the referenced schema
    visited.add(field.$ref);
    const referencedSchema = schemas[field.$ref];
    const schema = schemaToJsonSchema(field.$ref, referencedSchema, schemas, visited);
    visited.delete(field.$ref);
    return schema;
  }

  // Type is required if $ref is not present
  if (!field.type) {
    throw new Error(`Field "${fieldName}" must have either a type or $ref`);
  }

  const normalizedType = normalizeType(field.type);
  const schema: Record<string, unknown> = {
    type: normalizedType === "integer" ? "integer" : normalizedType
  };

  // Add format if specified
  if (field.format) {
    schema.format = field.format;
  }

  // Add enum if specified
  if (field.enum) {
    schema.enum = field.enum;
  }

  // Add pattern for strings
  if (field.pattern) {
    schema.pattern = field.pattern;
  }

  // Add min/max for numbers
  if (field.min !== undefined) {
    schema.minimum = field.min;
  }
  if (field.max !== undefined) {
    schema.maximum = field.max;
  }

  // Handle array/list types
  if ((field.type === "array" || field.type === "list") && field.items) {
    schema.items = fieldToJsonSchema(field.items, "item", schemas, visited);
  }

  // Handle object types
  if (field.type === "object" && field.properties) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [propName, propField] of Object.entries(field.properties)) {
      properties[propName] = fieldToJsonSchema(propField, propName, schemas, visited);
      if (propField.required) {
        required.push(propName);
      }
    }
    schema.properties = properties;
    schema.required = required;
  }

  return schema;
}

/**
 * Convert Yama schema definition to JSON Schema
 */
export function schemaToJsonSchema(
  schemaName: string,
  schemaDef: SchemaDefinition,
  schemas?: YamaSchemas,
  visited: Set<string> = new Set()
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [fieldName, field] of Object.entries(schemaDef.fields)) {
    properties[fieldName] = fieldToJsonSchema(field, fieldName, schemas, visited);
    
    if (field.required) {
      required.push(fieldName);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties,
    required
  };

  return schema;
}

/**
 * Schema validator class
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Register schemas and create validators
   */
  registerSchemas(schemas: YamaSchemas): void {
    this.validators.clear();

    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
      const schema = schemaToJsonSchema(schemaName, schemaDef, schemas);
      const validator = this.ajv.compile(schema);
      this.validators.set(schemaName, validator);
    }
  }

  /**
   * Validate data against a schema
   */
  validate(schemaName: string, data: unknown): ValidationResult {
    const validator = this.validators.get(schemaName);

    if (!validator) {
      return {
        valid: false,
        errorMessage: `Schema "${schemaName}" not found`
      };
    }

    const valid = validator(data);

    if (!valid) {
      return {
        valid: false,
        errors: validator.errors || []
      };
    }

    return { valid: true };
  }

  /**
   * Validate data against a JSON schema directly (without registering as a schema)
   */
  validateSchema(schema: Record<string, unknown>, data: unknown): ValidationResult {
    try {
      const validator = this.ajv.compile(schema);
      const valid = validator(data);

      if (!valid) {
        return {
          valid: false,
          errors: validator.errors || []
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Format validation errors into a readable message
   */
  formatErrors(errors: ErrorObject[]): string {
    return errors
      .map((error) => {
        const path = error.instancePath || error.schemaPath;
        const message = error.message;
        return `${path}: ${message}`;
      })
      .join(", ");
  }
}

/**
 * Create a new schema validator instance
 */
export function createSchemaValidator(): SchemaValidator {
  return new SchemaValidator();
}

// Authentication/Authorization types
export type AuthProviderType = "jwt" | "api-key" | "basic" | string; // string allows for oauth-* providers

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
  identifierField?: string; // Field to match identifier against (e.g., "email", "username")
  passwordField?: string; // Field containing password hash (default: "passwordHash")
}

export type BasicAuthProvider = BasicAuthProviderStatic | BasicAuthProviderDatabase;

export interface OAuthAuthProvider {
  type: string; // e.g., "oauth-google", "oauth-github"
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  autoGenerateEndpoints?: boolean; // Default: true
  [key: string]: unknown; // Allow provider-specific config
}

export type AuthProvider = JwtAuthProvider | ApiKeyAuthProvider | BasicAuthProvider | OAuthAuthProvider;

export interface AuthConfig {
  providers: AuthProvider[];
  /**
   * Optional role-to-permission mapping for permission-based authorization
   * Example: { admin: { permissions: ["*"] }, user: { permissions: ["posts:read", "posts:create"] } }
   */
  roles?: Record<string, { permissions: string[] }>;
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
  provider?: string; // Provider type or name to use
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

// Rate limiting types
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


