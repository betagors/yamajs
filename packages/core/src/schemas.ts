import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { TypeParser } from "./types/index.js";
import type { FieldType } from "./types/index.js";
import type { ComputedFieldDefinition } from "./entities.js";

// Type definitions for YAML schema structure
export interface SchemaField {
  // Type can be a primitive type or a schema name (e.g., "User", "User[]")
  type?: "uuid" | "string" | "number" | "boolean" | "integer" | "array" | "list" | "object" | string;
  required?: boolean;
  default?: unknown;
  format?: string;
  validator?: string; // Custom validator function name
  items?: SchemaField; // For array/list types (legacy, prefer type: "SchemaName[]")
  properties?: Record<string, SchemaField>; // For object types
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
  /** @deprecated Use direct type references like type: "User" or type: "User[]" instead */
  $ref?: string; // Reference to another schema name (deprecated)
}

/**
 * Normalize type: convert "list" to "array" for internal processing
 */
function normalizeType(type: string | undefined): string | undefined {
  return type === "list" ? "array" : type;
}

export interface SchemaDefinition {
  // Database config (can be at top level or in database:)
  table?: string; // Database table name (for schemas that map to database tables)
  fields: Record<string, SchemaField>;
  computed?: Record<string, ComputedFieldDefinition>;
  variants?: Record<string, import("./variants/types.js").VariantConfig>;
  database?: {
    table?: string; // Override table name
    indexes?: Array<{ fields: string[]; unique?: boolean; name?: string }>;
  };
}

// Re-export for convenience
export type { ComputedFieldDefinition } from "./entities.js";

export interface YamaSchemas {
  [schemaName: string]: SchemaDefinition;
}

/**
 * Parse schema field definition using new type system
 * Uses TypeParser for all type parsing
 */
export function parseSchemaFieldDefinition(
  fieldName: string,
  fieldDef: SchemaField | string,
  availableSchemas?: Set<string>
): SchemaField {
  // Fast path: already parsed
  if (typeof fieldDef !== "string") {
    // Ensure it has a type
    if (!fieldDef.type) {
      throw new Error(`Field "${fieldName}" must have a type property. Received: ${JSON.stringify(fieldDef)}`);
    }
    return fieldDef;
  }

  const str = fieldDef.trim();

  // Handle empty string
  if (!str) {
    throw new Error(`Field "${fieldName}" has an empty type definition`);
  }

  // Check if this is a schema reference (capitalized name)
  let schemaCheckStr = str;
  if (schemaCheckStr.endsWith("[]")) {
    schemaCheckStr = schemaCheckStr.slice(0, -2);
  }
  if (schemaCheckStr.endsWith("!") || schemaCheckStr.endsWith("?")) {
    schemaCheckStr = schemaCheckStr.slice(0, -1);
  }
  // Remove type parameters for check
  const paramMatch = schemaCheckStr.match(/^(\w+)(?:\(.*?\))?$/);
  const baseName = paramMatch ? paramMatch[1] : schemaCheckStr;

  const isSchemaReference = /^[A-Z][a-zA-Z0-9]*$/.test(baseName) &&
    (availableSchemas?.has(baseName) ?? true);

  if (isSchemaReference) {
    // This is a schema reference
    const parsed = TypeParser.parse(str);
    const field: SchemaField = {
      type: parsed.array ? `${baseName}[]` : baseName,
      required: !parsed.nullable,
    };
    return field;
  }

  // Use TypeParser for all type parsing
  const parsedType = TypeParser.parse(str);

  // Convert FieldType to SchemaField
  const field: SchemaField = {
    type: parsedType.type as SchemaField["type"],
    required: !parsedType.nullable,
    default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
    minLength: parsedType.minLength,
    maxLength: parsedType.maxLength,
    min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
    max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
    pattern: parsedType.pattern,
    enum: parsedType.enumValues,
  };

  // Map new types to schema types
  if (parsedType.type === 'email' || parsedType.type === 'url' || parsedType.type === 'phone' || parsedType.type === 'slug') {
    field.type = "string";
    if (parsedType.type === 'email') {
      field.format = "email";
    } else if (parsedType.type === 'url') {
      field.format = "uri";
    }
  } else if (parsedType.type === 'text') {
    field.type = "string";
  } else if (parsedType.type === 'int' || parsedType.type === 'int8' || parsedType.type === 'int16' ||
    parsedType.type === 'int32' || parsedType.type === 'int64' || parsedType.type === 'uint') {
    field.type = "integer";
  } else if (parsedType.type === 'decimal' || parsedType.type === 'money' ||
    parsedType.type === 'float' || parsedType.type === 'double') {
    field.type = "number";
  } else if (parsedType.type === 'timestamp' || parsedType.type === 'timestamptz' ||
    parsedType.type === 'timestamplocal' || parsedType.type === 'datetime' ||
    parsedType.type === 'datetimetz' || parsedType.type === 'datetimelocal') {
    field.type = "string";
    field.format = "date-time";
  } else if (parsedType.type === 'date') {
    field.type = "string";
    field.format = "date";
  } else if (parsedType.type === 'time') {
    field.type = "string";
    field.format = "time";
  } else if (parsedType.type === 'json' || parsedType.type === 'jsonb') {
    field.type = "object";
  } else if (parsedType.type === 'enum') {
    field.type = "string";
    field.enum = parsedType.enumValues;
  } else {
    // For types that don't need mapping (like 'string', 'uuid', etc.), ensure type is set
    // parsedType.type should already be set in the field above, but double-check
    if (!field.type) {
      // Fallback: use the parsed type as-is
      field.type = parsedType.type as SchemaField["type"];
    }
  }

  // Final check: ensure type is always set
  if (!field.type) {
    throw new Error(`Field "${fieldName}" could not be parsed to determine type. Input: "${str}", Parsed: ${JSON.stringify(parsedType)}`);
  }

  return field;
}

/**
 * Normalize a schema definition
 * Parses shorthand field syntax automatically using new type system
 */
export function normalizeSchemaDefinition(
  schemaDef: SchemaDefinition | { fields?: Record<string, SchemaField | string>; computed?: any; variants?: any; database?: any }
): SchemaDefinition {
  // Validate input
  if (!schemaDef || typeof schemaDef !== 'object' || schemaDef === null) {
    throw new Error(
      `Invalid schema definition: expected an object, but got ${typeof schemaDef}`
    );
  }

  // Must have fields property
  if (!('fields' in schemaDef)) {
    const keys = Object.keys(schemaDef);
    throw new Error(
      `Invalid schema definition format. Expected { fields: {...} }, ` +
      `but got an object with keys: ${keys.length > 0 ? keys.join(', ') : '(empty object)'}`
    );
  }

  if (!schemaDef.fields || typeof schemaDef.fields !== 'object' || schemaDef.fields === null) {
    throw new Error(
      `Invalid schema definition: expected fields to be an object, but got ${typeof schemaDef.fields}`
    );
  }

  // Parse fields using new type system
  // Note: availableSchemas will be populated when schemas are normalized together
  const fields: Record<string, SchemaField> = {};
  for (const [fieldName, fieldDef] of Object.entries(schemaDef.fields)) {
    if (typeof fieldDef === "string") {
      // New concise syntax - parse using TypeParser
      fields[fieldName] = parseSchemaFieldDefinition(fieldName, fieldDef);
    } else if (fieldDef && typeof fieldDef === "object") {
      // Expanded object syntax - parse using TypeParser.parseExpanded
      const parsedType = TypeParser.parseExpanded(fieldDef as any);
      fields[fieldName] = {
        type: parsedType.type as SchemaField["type"],
        required: !parsedType.nullable,
        default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
        minLength: parsedType.minLength,
        maxLength: parsedType.maxLength,
        min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
        max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
        pattern: parsedType.pattern,
        enum: parsedType.enumValues,
        // Map new types to schema types
        ...(parsedType.type === 'email' && { format: 'email' }),
        ...(parsedType.type === 'url' && { format: 'uri' }),
        ...(parsedType.type === 'date' && { format: 'date' }),
        ...(parsedType.type === 'time' && { format: 'time' }),
        ...((parsedType.type === 'timestamp' || parsedType.type === 'timestamptz' ||
          parsedType.type === 'timestamplocal' || parsedType.type === 'datetime') && { format: 'date-time' }),
      };
    } else {
      throw new Error(
        `Invalid field definition for "${fieldName}": expected a string or object, but got ${typeof fieldDef}`
      );
    }
  }

  const normalized: SchemaDefinition = { fields };

  // Preserve computed fields
  if (schemaDef.computed !== undefined) {
    normalized.computed = schemaDef.computed;
  }

  // Preserve variants
  if (schemaDef.variants !== undefined) {
    normalized.variants = schemaDef.variants;
  }

  // Preserve database config
  if (schemaDef.database !== undefined) {
    normalized.database = schemaDef.database;
  }

  return normalized;
}

/**
 * Normalize query/params from schema format to internal format
 * Handles Record<string, SchemaField | string> format (supports shorthand)
 */
export function normalizeQueryOrParams(
  queryOrParams: Record<string, SchemaField | string> | undefined
): Record<string, SchemaField> | undefined {
  if (!queryOrParams || typeof queryOrParams !== 'object' || queryOrParams === null) {
    return undefined;
  }

  const fields: Record<string, SchemaField> = {};

  for (const [fieldName, fieldDef] of Object.entries(queryOrParams)) {
    if (typeof fieldDef === "string") {
      // Shorthand syntax - parse it
      fields[fieldName] = parseSchemaFieldDefinition(fieldName, fieldDef);
    } else if (fieldDef && typeof fieldDef === "object") {
      // Already an object - check if it has a type
      if (fieldDef.type) {
        // Has type - use as-is
        fields[fieldName] = {
          ...fieldDef,
          required: fieldDef.required === true
        };
      } else {
        // No type - try to parse it as an expanded field definition
        const parsedType = TypeParser.parseExpanded(fieldDef as any);
        fields[fieldName] = {
          type: parsedType.type as SchemaField["type"],
          required: !parsedType.nullable,
          default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
          minLength: parsedType.minLength,
          maxLength: parsedType.maxLength,
          min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
          max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
          pattern: parsedType.pattern,
          enum: parsedType.enumValues,
          // Map new types to schema types
          ...(parsedType.type === 'email' && { format: 'email' }),
          ...(parsedType.type === 'url' && { format: 'uri' }),
          ...(parsedType.type === 'date' && { format: 'date' }),
          ...(parsedType.type === 'time' && { format: 'time' }),
          ...((parsedType.type === 'timestamp' || parsedType.type === 'timestamptz' ||
            parsedType.type === 'timestamplocal' || parsedType.type === 'datetime') && { format: 'date-time' }),
        };
      }
    }
  }

  return fields;
}

/**
 * Normalize body definition - handles string (schema reference), object with type, or object with fields
 */
export function normalizeBodyDefinition(
  body: string | { type?: string; fields?: Record<string, SchemaField | string>; properties?: Record<string, SchemaField> } | undefined
): { type?: string; fields?: Record<string, SchemaField> } | undefined {
  if (!body) {
    return undefined;
  }

  // String shorthand - schema reference
  if (typeof body === "string") {
    return { type: body };
  }

  // Object with type (schema reference)
  if (body.type && typeof body.type === "string") {
    return { type: body.type };
  }

  // Object with fields (new format)
  if (body.fields && typeof body.fields === "object") {
    const fields: Record<string, SchemaField> = {};
    for (const [fieldName, fieldDef] of Object.entries(body.fields)) {
      if (typeof fieldDef === "string") {
        fields[fieldName] = parseSchemaFieldDefinition(fieldName, fieldDef);
      } else if (fieldDef && typeof fieldDef === "object") {
        // Expanded object syntax - parse using TypeParser.parseExpanded
        const parsedType = TypeParser.parseExpanded(fieldDef as any);
        fields[fieldName] = {
          type: parsedType.type as SchemaField["type"],
          required: !parsedType.nullable,
          default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
          minLength: parsedType.minLength,
          maxLength: parsedType.maxLength,
          min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
          max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
          pattern: parsedType.pattern,
          enum: parsedType.enumValues,
          // Map new types to schema types
          ...(parsedType.type === 'email' && { format: 'email' }),
          ...(parsedType.type === 'url' && { format: 'uri' }),
          ...(parsedType.type === 'date' && { format: 'date' }),
          ...(parsedType.type === 'time' && { format: 'time' }),
          ...((parsedType.type === 'timestamp' || parsedType.type === 'timestamptz' ||
            parsedType.type === 'timestamplocal' || parsedType.type === 'datetime') && { format: 'date-time' }),
        };
      } else {
        throw new Error(
          `Invalid field definition for "${fieldName}" in body: expected a string or object, but got ${typeof fieldDef}`
        );
      }
    }
    return { fields };
  }

  // Legacy: object with properties (deprecated but handle for now)
  if (body.properties && typeof body.properties === "object") {
    const fields: Record<string, SchemaField> = {};
    for (const [fieldName, fieldDef] of Object.entries(body.properties)) {
      if (fieldDef && typeof fieldDef === "object") {
        fields[fieldName] = {
          ...fieldDef,
          required: fieldDef.required === true
        };
      }
    }
    return { fields };
  }

  return undefined;
}

// Validation error result
export interface ValidationResult {
  valid: boolean;
  errors?: ErrorObject[];
  errorMessage?: string;
}

/**
 * Check if a type string is a schema reference (e.g., "User", "User[]")
 */
function isSchemaReference(type: string, schemas?: YamaSchemas): boolean {
  if (!schemas) return false;

  // Check for array syntax like "User[]"
  const arrayMatch = type.match(/^(.+)\[\]$/);
  if (arrayMatch) {
    return schemas[arrayMatch[1]] !== undefined;
  }

  // Check for direct schema reference
  return schemas[type] !== undefined;
}

/**
 * Convert Yama schema field to JSON Schema property
 * @param useOpenAPIFormat - If true, use OpenAPI 3.0 format (#/components/schemas/), otherwise use JSON Schema format (#/definitions/)
 */
export function fieldToJsonSchema(
  field: SchemaField,
  fieldName: string,
  schemas?: YamaSchemas,
  visited: Set<string> = new Set(),
  useOpenAPIFormat: boolean = true
): Record<string, unknown> {
  // Handle legacy $ref (deprecated but still supported)
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
    const schema = schemaToJsonSchema(field.$ref, referencedSchema, schemas, visited, useOpenAPIFormat);
    visited.delete(field.$ref);
    return schema;
  }

  // Type is required
  if (!field.type) {
    throw new Error(`Field "${fieldName}" must have a type`);
  }

  const typeStr = String(field.type);

  // Define primitive types that should NOT be treated as schema references
  const primitiveTypes = ["string", "number", "boolean", "integer", "array", "list", "object"];
  const isPrimitive = primitiveTypes.includes(typeStr);

  // Handle array syntax like "User[]" - this is the preferred way
  const arrayMatch = typeStr.match(/^(.+)\[\]$/);
  if (arrayMatch) {
    const baseType = arrayMatch[1];
    // Check if baseType is a primitive (shouldn't happen, but be safe)
    if (primitiveTypes.includes(baseType)) {
      // This is invalid - can't have "string[]" as a type, should use items instead
      throw new Error(`Invalid array type "${typeStr}". Use type: "array" with items instead.`);
    }

    if (!schemas || !schemas[baseType]) {
      throw new Error(`Schema reference "${baseType}" not found (in array type "${typeStr}")`);
    }

    if (visited.has(baseType)) {
      throw new Error(`Circular reference detected: ${baseType}`);
    }

    // Return JSON Schema array with $ref
    const refPrefix = useOpenAPIFormat ? "#/components/schemas/" : "#/definitions/";
    return {
      type: "array",
      items: {
        $ref: `${refPrefix}${baseType}`
      }
    };
  }

  // Handle direct schema reference (e.g., type: "User")
  // Only if it's NOT a primitive type and it exists in schemas
  if (!isPrimitive && schemas && schemas[typeStr]) {
    if (visited.has(typeStr)) {
      throw new Error(`Circular reference detected: ${typeStr}`);
    }

    // Return JSON Schema $ref format
    const refPrefix = useOpenAPIFormat ? "#/components/schemas/" : "#/definitions/";
    return {
      $ref: `${refPrefix}${typeStr}`
    };
  }

  // Handle primitive types
  const normalizedType = normalizeType(typeStr);

  // Special handling for uuid - convert to string with format in JSON Schema
  if (typeStr === "uuid") {
    const schema: Record<string, unknown> = {
      type: "string",
      format: "uuid"
    };
    // Add additional format if specified (shouldn't happen, but be safe)
    if (field.format && field.format !== "uuid") {
      schema.format = field.format;
    }
    // Continue with rest of field properties
    if (field.enum) {
      schema.enum = field.enum;
    }
    if (field.pattern) {
      schema.pattern = field.pattern;
    }
    return schema;
  }

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

  // Handle legacy array/list types with items property
  if ((normalizedType === "array" || normalizedType === "list") && field.items) {
    schema.items = fieldToJsonSchema(field.items, "item", schemas, visited);
  }

  // Handle object types
  if (normalizedType === "object" && field.properties) {
    // Defensive check: ensure properties is a valid object before calling Object.entries
    if (!field.properties || typeof field.properties !== 'object' || field.properties === null) {
      throw new Error(
        `Field "${fieldName}" has invalid properties. ` +
        `Expected an object, but got: ${typeof field.properties}`
      );
    }

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
 * @param useOpenAPIFormat - If true, use OpenAPI 3.0 format (#/components/schemas/), otherwise use JSON Schema format (#/definitions/)
 */
export function schemaToJsonSchema(
  schemaName: string,
  schemaDef: SchemaDefinition | { fields?: Record<string, SchemaField | string> },
  schemas?: YamaSchemas,
  visited: Set<string> = new Set(),
  useOpenAPIFormat: boolean = true
): Record<string, unknown> {
  if (visited.has(schemaName)) {
    throw new Error(`Circular reference detected in schema: ${schemaName}`);
  }
  visited.add(schemaName);

  // Normalize schema to internal format first
  let normalizedSchema: SchemaDefinition;
  try {
    normalizedSchema = normalizeSchemaDefinition(schemaDef);
  } catch (error) {
    throw new Error(
      `Failed to normalize schema "${schemaName}": ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Handle source inheritance - merge fields from source
  let fieldsToProcess: Record<string, SchemaField> = {};
  if ((schemaDef as any).source && schemas) {
    const sourceName = (schemaDef as any).source;
    const sourceSchema = schemas[sourceName];
    if (sourceSchema) {
      // Normalize source schema to get its fields
      const normalizedSource = normalizeSchemaDefinition(sourceSchema);
      if (normalizedSource.fields && typeof normalizedSource.fields === 'object') {
        // Convert source fields to SchemaField format
        for (const [fieldName, fieldDef] of Object.entries(normalizedSource.fields)) {
          const field = typeof fieldDef === "string"
            ? parseSchemaFieldDefinition(fieldName, fieldDef)
            : fieldDef as SchemaField;
          fieldsToProcess[fieldName] = field;
        }
      }

      // If include is specified, only include those fields
      const includeFields = (schemaDef as any).include;
      if (Array.isArray(includeFields)) {
        const filtered: Record<string, SchemaField> = {};
        for (const fieldName of includeFields) {
          if (fieldsToProcess[fieldName]) {
            filtered[fieldName] = fieldsToProcess[fieldName];
          }
        }
        fieldsToProcess = filtered;
      }
    }
  }

  // Merge with fields from this schema (override source fields)
  if (normalizedSchema.fields && typeof normalizedSchema.fields === 'object' && normalizedSchema.fields !== null) {
    // Convert normalized fields to SchemaField format for merging
    for (const [fieldName, fieldDef] of Object.entries(normalizedSchema.fields)) {
      const field = typeof fieldDef === "string"
        ? parseSchemaFieldDefinition(fieldName, fieldDef)
        : fieldDef as SchemaField;
      fieldsToProcess[fieldName] = field;
    }
  }

  // If no fields at all, throw error
  if (Object.keys(fieldsToProcess).length === 0) {
    throw new Error(
      `Schema "${schemaName}" has no fields. ` +
      `Schema definition keys: ${Object.keys(schemaDef).join(', ')}`
    );
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [fieldName, field] of Object.entries(fieldsToProcess)) {
    try {
      properties[fieldName] = fieldToJsonSchema(field, fieldName, schemas, new Set(visited), useOpenAPIFormat);

      if (field.required) {
        required.push(fieldName);
      }
    } catch (error) {
      throw new Error(
        `Failed to convert field "${fieldName}" in schema "${schemaName}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Add computed fields
  if (normalizedSchema.computed && typeof normalizedSchema.computed === 'object') {
    for (const [fieldName, computedDef] of Object.entries(normalizedSchema.computed)) {
      // Determine computed field type
      let computedType = "string";
      if (typeof computedDef === "object" && computedDef.type) {
        computedType = computedDef.type;
      } else {
        const expr = typeof computedDef === "string" ? computedDef : computedDef.expression;
        if (expr.includes("count(") || expr.includes("sum(") || expr.includes("avg(")) {
          computedType = "number";
        }
      }
      properties[fieldName] = { type: computedType, description: "Computed field" };
    }
  }

  visited.delete(schemaName);

  const schema: Record<string, unknown> = {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined
  };

  return schema;
}

/**
 * Custom validator function type
 */
export type CustomValidator = (value: unknown, field: SchemaField, data: unknown) => boolean | string | Promise<boolean | string>;

/**
 * Schema validator class
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private customValidators: Map<string, CustomValidator> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateSchema: false // Don't validate schema structure itself
    });
    addFormats(this.ajv);
  }

  /**
   * Register a custom validator function
   */
  registerCustomValidator(name: string, validator: CustomValidator): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Get a custom validator by name
   */
  getCustomValidator(name: string): CustomValidator | undefined {
    return this.customValidators.get(name);
  }

  /**
   * Register schemas and create validators
   */
  registerSchemas(schemas: YamaSchemas): void {
    this.validators.clear();

    // Build definitions map for $ref support (use JSON Schema format for AJV)
    const definitions: Record<string, unknown> = {};
    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
      const schema = schemaToJsonSchema(schemaName, schemaDef, schemas, new Set(), false); // false = JSON Schema format
      definitions[schemaName] = schema;
    }

    // Register each schema with definitions included
    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
      const schema = schemaToJsonSchema(schemaName, schemaDef, schemas, new Set(), false); // false = JSON Schema format
      // Add definitions to support $ref
      const schemaWithDefs = {
        ...schema,
        definitions
      };
      const validator = this.ajv.compile(schemaWithDefs);
      this.validators.set(schemaName, validator);
    }
  }

  /**
   * Validate data against a schema
   */
  async validate(schemaName: string, data: unknown): Promise<ValidationResult> {
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

    // Run custom validators if schema has them
    // Note: This requires access to the schema definition to check for custom validators
    // For now, custom validators should be called explicitly by the handler

    return { valid: true };
  }

  /**
   * Validate a field value with custom validator if specified
   */
  async validateField(
    fieldName: string,
    field: SchemaField,
    value: unknown,
    data: unknown
  ): Promise<{ valid: boolean; error?: string }> {
    if (!field.validator) {
      return { valid: true };
    }

    const customValidator = this.customValidators.get(field.validator);
    if (!customValidator) {
      return {
        valid: false,
        error: `Custom validator "${field.validator}" not found for field "${fieldName}"`
      };
    }

    try {
      const result = await customValidator(value, field, data);
      if (typeof result === "string") {
        return { valid: false, error: result };
      }
      return { valid: result };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
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

// AuthContext is now defined in auth/types.ts with full plugin extension support
// Re-export for backward compatibility
export type { AuthContext, AuthUser } from "./auth/types.js";

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

// Re-export ApisConfig from apis module
export type { ApisConfig } from "./apis/types.js";


