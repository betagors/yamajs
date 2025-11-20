import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import addFormats from "ajv-formats";

// Type definitions for YAML model structure
export interface ModelField {
  type?: "string" | "number" | "boolean" | "integer" | "array" | "object";
  required?: boolean;
  default?: unknown;
  format?: string;
  items?: ModelField; // For array types
  properties?: Record<string, ModelField>; // For object types
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  $ref?: string; // Reference to another model name
}

export interface ModelDefinition {
  fields: Record<string, ModelField>;
}

export interface YamaModels {
  [modelName: string]: ModelDefinition;
}

// Validation error result
export interface ValidationResult {
  valid: boolean;
  errors?: ErrorObject[];
  errorMessage?: string;
}

/**
 * Convert Yama model field to JSON Schema property
 */
function fieldToJsonSchema(
  field: ModelField,
  fieldName: string,
  models?: YamaModels,
  visited: Set<string> = new Set()
): Record<string, unknown> {
  // Handle model references
  if (field.$ref) {
    if (visited.has(field.$ref)) {
      throw new Error(`Circular reference detected: ${field.$ref}`);
    }

    if (!models || !models[field.$ref]) {
      throw new Error(`Model reference "${field.$ref}" not found`);
    }

    // Recursively convert the referenced model
    visited.add(field.$ref);
    const referencedModel = models[field.$ref];
    const schema = modelToJsonSchema(field.$ref, referencedModel, models, visited);
    visited.delete(field.$ref);
    return schema;
  }

  // Type is required if $ref is not present
  if (!field.type) {
    throw new Error(`Field "${fieldName}" must have either a type or $ref`);
  }

  const schema: Record<string, unknown> = {
    type: field.type === "integer" ? "integer" : field.type
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

  // Handle array types
  if (field.type === "array" && field.items) {
    schema.items = fieldToJsonSchema(field.items, "item", models, visited);
  }

  // Handle object types
  if (field.type === "object" && field.properties) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [propName, propField] of Object.entries(field.properties)) {
      properties[propName] = fieldToJsonSchema(propField, propName, models, visited);
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
 * Convert Yama model definition to JSON Schema
 */
export function modelToJsonSchema(
  modelName: string,
  modelDef: ModelDefinition,
  models?: YamaModels,
  visited: Set<string> = new Set()
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [fieldName, field] of Object.entries(modelDef.fields)) {
    properties[fieldName] = fieldToJsonSchema(field, fieldName, models, visited);
    
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
 * Model validator class
 */
export class ModelValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Register models and create validators
   */
  registerModels(models: YamaModels): void {
    this.validators.clear();

    for (const [modelName, modelDef] of Object.entries(models)) {
      const schema = modelToJsonSchema(modelName, modelDef, models);
      const validator = this.ajv.compile(schema);
      this.validators.set(modelName, validator);
    }
  }

  /**
   * Validate data against a model
   */
  validate(modelName: string, data: unknown): ValidationResult {
    const validator = this.validators.get(modelName);

    if (!validator) {
      return {
        valid: false,
        errorMessage: `Model "${modelName}" not found`
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
 * Create a new model validator instance
 */
export function createModelValidator(): ModelValidator {
  return new ModelValidator();
}

