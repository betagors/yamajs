/**
 * Validation utilities for YAMA Node Runtime
 * 
 * This module provides validation and type coercion utilities for
 * query parameters, path parameters, and request bodies.
 */

import type { SchemaField, YamaSchemas } from "@betagors/yama-core";
import { fieldToJsonSchema } from "@betagors/yama-core";

/**
 * Build a JSON schema for query/path parameter validation
 * 
 * Converts YAMA field definitions to JSON Schema format for validation.
 * Used for validating query parameters and path parameters before
 * passing them to handlers.
 * 
 * @param queryParams - Map of parameter names to field definitions
 * @param schemas - Schema registry for resolving $ref types
 * @returns JSON schema object for validation
 * 
 * @example
 * ```typescript
 * const querySchema = buildQuerySchema({
 *   limit: { type: "integer", default: 10 },
 *   search: { type: "string", required: false }
 * });
 * // Result: { type: "object", properties: {...}, required: [...] }
 * ```
 */
export function buildQuerySchema(
  queryParams: Record<string, SchemaField>,
  schemas?: YamaSchemas
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [paramName, paramField] of Object.entries(queryParams)) {
    // Convert the field directly to JSON schema
    properties[paramName] = fieldToJsonSchema(paramField, paramName, schemas);
    
    if (paramField.required) {
      required.push(paramName);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties
  };
  
  if (required.length > 0) {
    schema.required = required;
  }
  
  return schema;
}

/**
 * Coerce path/query parameters to their proper types
 * 
 * Parameters come as strings from URLs, so we need to convert them to
 * the correct types (boolean, number, etc.) based on their definitions.
 * 
 * @param params - Raw parameters from request (all strings)
 * @param paramDefs - Parameter field definitions
 * @param schemas - Schema registry for resolving $ref types
 * @returns Coerced parameters with correct types
 * 
 * @remarks
 * - Unknown parameters are passed through as-is
 * - Empty/null values use defaults if available
 * - Handles boolean conversion ("true"/"false" strings → boolean)
 * - Handles number conversion (string → number)
 * 
 * @example
 * ```typescript
 * const params = { limit: "10", active: "true", name: "Product" };
 * const defs = {
 *   limit: { type: "integer" },
 *   active: { type: "boolean" },
 *   name: { type: "string" }
 * };
 * const coerced = coerceParams(params, defs);
 * // Result: { limit: 10, active: true, name: "Product" }
 * ```
 */
export function coerceParams(
  params: Record<string, unknown>,
  paramDefs: Record<string, SchemaField>,
  schemas?: YamaSchemas
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const paramDef = paramDefs[key];
    if (!paramDef) {
      // Unknown query param, pass through as-is
      coerced[key] = value;
      continue;
    }

    // Handle type coercion
    if (value === undefined || value === null || value === "") {
      if (paramDef.default !== undefined) {
        coerced[key] = paramDef.default;
      } else if (!paramDef.required) {
        // Optional param with no value, skip it
        continue;
      }
      coerced[key] = value;
      continue;
    }

    const type = paramDef.$ref ? 
      (schemas?.[paramDef.$ref]?.fields ? "object" : undefined) : 
      paramDef.type;

    switch (type) {
      case "boolean":
        // Handle string "true"/"false" or actual booleans
        if (typeof value === "string") {
          coerced[key] = value.toLowerCase() === "true" || value === "1";
        } else {
          coerced[key] = Boolean(value);
        }
        break;
      case "integer":
      case "number":
        const num = typeof value === "string" ? parseFloat(value) : Number(value);
        coerced[key] = isNaN(num) ? value : num;
        break;
      default:
        coerced[key] = value;
    }
  }

  return coerced;
}
