/**
 * Entity and field utilities for YAMA Node Runtime
 * 
 * This module provides utilities for working with entity definitions,
 * extracting field names, and mapping between database and API representations.
 */

import type { YamaEntities, EntityField, EntityDefinition } from "@betagors/yama-core";
import { parseFieldDefinition } from "@betagors/yama-core";

/**
 * Extract entity name from response type
 * 
 * Handles patterns like:
 * - "Product[]" → "Product"
 * - "Product" → "Product"
 * 
 * Used to detect which entity a response type refers to.
 * 
 * @param responseType - Response type string from endpoint definition
 * @param entities - Entity definitions from configuration
 * @returns Entity name or null if not found
 * 
 * @example
 * ```typescript
 * extractEntityNameFromResponseType("Product[]", entities);
 * // Returns: "Product"
 * 
 * extractEntityNameFromResponseType("Product", entities);
 * // Returns: "Product"
 * ```
 */
export function extractEntityNameFromResponseType(
  responseType: string,
  entities: YamaEntities
): string | null {
  // Handle array syntax: "Product[]" -> "Product"
  const arrayMatch = responseType.match(/^(.+)\[\]$/);
  if (arrayMatch) {
    const entityName = arrayMatch[1];
    if (entities[entityName]) {
      return entityName;
    }
  }

  // Try direct match (e.g., "Product")
  if (entities[responseType]) {
    return responseType;
  }

  return null;
}

/**
 * Get API field name from entity field definition
 * 
 * Determines the field name to use in API responses, considering:
 * 1. Explicit `api` name if provided
 * 2. `dbColumn` converted to camelCase
 * 3. Original field name as fallback
 * 
 * @param fieldName - Original field name from entity definition
 * @param field - Parsed field definition
 * @returns API field name to use in JSON responses
 * 
 * @example
 * ```typescript
 * // With explicit api name:
 * getApiFieldNameFromEntity("userId", { api: "user", type: "string" });
 * // Returns: "user"
 * 
 * // With dbColumn:
 * getApiFieldNameFromEntity("userId", { dbColumn: "user_id", type: "string" });
 * // Returns: "userId" (snake_case converted to camelCase)
 * 
 * // Default:
 * getApiFieldNameFromEntity("userId", { type: "string" });
 * // Returns: "userId"
 * ```
 */
export function getApiFieldNameFromEntity(fieldName: string, field: EntityField): string {
  // Use explicit api name if provided
  if (field.api && typeof field.api === "string") {
    return field.api;
  }

  // Convert dbColumn to camelCase if provided
  if (field.dbColumn) {
    return field.dbColumn.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  // Use field name as-is
  return fieldName;
}

/**
 * Get primary key field name from entity definition
 * 
 * Searches for the field marked as primary key and returns its API name.
 * Defaults to "id" if no primary key is explicitly defined.
 * 
 * @param entityDef - Entity definition from configuration
 * @returns API field name of the primary key
 * 
 * @remarks
 * - Returns "id" as fallback if no fields or no primary key found
 * - Uses API field name (respects api/dbColumn mappings)
 * 
 * @example
 * ```typescript
 * const entity = {
 *   fields: {
 *     userId: { type: "string", primary: true, dbColumn: "user_id" }
 *   }
 * };
 * 
 * getPrimaryKeyFieldName(entity);
 * // Returns: "userId" (camelCase API name from dbColumn)
 * ```
 */
export function getPrimaryKeyFieldName(entityDef: EntityDefinition): string {
  if (!entityDef.fields) {
    return "id"; // Default fallback
  }
  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef);
    if (field.primary) {
      return getApiFieldNameFromEntity(fieldName, field);
    }
  }
  return "id"; // Default fallback
}
