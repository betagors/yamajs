/**
 * Query mapping utilities for YAMA Node Runtime
 * 
 * This module handles mapping query parameters to repository findAll options,
 * including pagination, sorting, searching, and field filtering.
 */

import type { EntityDefinition, CrudConfig, HandlerContext } from "@betagors/yama-core";
import { parseFieldDefinition, detectPaginationFromQuery } from "@betagors/yama-core";
import { getApiFieldNameFromEntity } from "./entity-utils.js";

/**
 * Map query parameters to repository findAll options
 * 
 * Converts HTTP query parameters into repository options for database queries.
 * Handles:
 * - Pagination (limit, offset, page, pageSize, cursor)
 * - Sorting (orderBy, orderDirection)
 * - Search (full-text search across specified fields)
 * - Field filters (exact matches on entity fields)
 * 
 * @param query - Query parameters from request
 * @param entityDef - Entity definition
 * @param entityConfig - Entity configuration (for CRUD settings)
 * @returns Repository findAll options object
 * 
 * @remarks
 * - Automatically detects pagination type from query params
 * - Search is auto-enabled if entity has string/text fields
 * - Unknown query params are matched against entity fields
 * - Special params (limit, offset, page, etc.) are not passed to field filters
 * 
 * @example
 * ```typescript
 * const query = {
 *   limit: "10",
 *   orderBy: "createdAt:desc",
 *   search: "laptop",
 *   category: "electronics"
 * };
 * 
 * const options = mapQueryToFindAllOptions(query, entityDef);
 * // Returns: {
 * //   limit: 10,
 * //   orderBy: { field: "createdAt", direction: "desc" },
 * //   search: "laptop",
 * //   searchFields: ["name", "description"],
 * //   searchMode: "contains",
 * //   category: "electronics"
 * // }
 * ```
 */
export function mapQueryToFindAllOptions(
  query: Record<string, unknown>,
  entityDef: EntityDefinition,
  entityConfig?: EntityDefinition
): {
  [key: string]: unknown;
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction?: "asc" | "desc" };
  search?: string;
  searchFields?: string[];
  searchMode?: "contains" | "starts" | "ends" | "exact";
} {
  const options: {
    [key: string]: unknown;
    limit?: number;
    offset?: number;
    orderBy?: { field: string; direction?: "asc" | "desc" };
  } = {};

  // ===== Extract pagination =====
  // Try to detect pagination type from query params
  const detectedPagination = detectPaginationFromQuery(query);
  
  if (detectedPagination) {
    options.limit = detectedPagination.limit;
    options.offset = detectedPagination.offset;
    
    // For cursor pagination, we'd need repository support
    // For now, we'll use offset-based approach
    // The cursor value could be used for filtering if repository supports it
  } else {
    // Fallback to legacy limit/offset if no pagination type detected
    if (query.limit !== undefined) {
      options.limit = typeof query.limit === "number" ? query.limit : Number(query.limit);
    }
    if (query.offset !== undefined) {
      options.offset = typeof query.offset === "number" ? query.offset : Number(query.offset);
    }
  }

  // ===== Extract orderBy =====
  if (query.orderBy) {
    const orderByStr = String(query.orderBy);
    if (orderByStr.includes(":")) {
      // Format: orderBy=field:direction
      const [field, direction] = orderByStr.split(":");
      options.orderBy = {
        field: field.trim(),
        direction: (direction?.trim().toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc",
      };
    } else {
      // Format: orderBy=field (use orderDirection if provided)
      const direction = query.orderDirection 
        ? (String(query.orderDirection).toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc"
        : undefined;
      options.orderBy = {
        field: orderByStr,
        ...(direction && { direction }),
      };
    }
  }

  // ===== Handle search parameter =====
  // Auto-enabled if entity has searchable fields
  if (query.search !== undefined) {
    // Check if search should be enabled
    const crudConfig = entityConfig?.crud;
    let searchEnabled = false;
    let searchConfig: CrudConfig["search"] | undefined;

    if (crudConfig) {
      if (typeof crudConfig === "object") {
        searchConfig = crudConfig.search;
        // Explicitly disabled
        if (searchConfig === false) {
          searchEnabled = false;
        } else {
          // Enabled if config exists or entity has searchable fields
          searchEnabled = true;
        }
      } else {
        // CRUD is boolean - check if entity has searchable fields
        const hasSearchableFields = entityDef.fields ? Object.entries(entityDef.fields).some(
          ([fieldName, fieldDef]) => {
            const field = parseFieldDefinition(fieldName, fieldDef);
            return field.api !== false && (field.type === "string" || field.type === "text");
          }
        ) : false;
        searchEnabled = hasSearchableFields;
      }
    } else {
      // No CRUD config - check if entity has searchable fields (auto-enable)
      const hasSearchableFields = entityDef.fields ? Object.entries(entityDef.fields).some(
        ([fieldName, fieldDef]) => {
          const field = parseFieldDefinition(fieldName, fieldDef);
          return field.api !== false && (field.type === "string" || field.type === "text");
        }
      ) : false;
      searchEnabled = hasSearchableFields;
    }

    if (searchEnabled) {
      options.search = String(query.search);
      
      // Get search mode
      if (searchConfig && typeof searchConfig === "object" && !Array.isArray(searchConfig) && searchConfig.mode) {
        options.searchMode = searchConfig.mode;
      } else {
        options.searchMode = "contains"; // Default
      }

      // Determine searchable fields
      if (searchConfig === true) {
        // Use all searchable fields
        const searchable: string[] = [];
        if (entityDef.fields) {
          for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
            const field = parseFieldDefinition(fieldName, fieldDef);
            if (field.api !== false && (field.type === "string" || field.type === "text")) {
              const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
              searchable.push(apiFieldName);
            }
          }
        }
        options.searchFields = searchable;
      } else if (Array.isArray(searchConfig)) {
        // Specific fields
        options.searchFields = searchConfig;
      } else if (searchConfig && typeof searchConfig === "object" && searchConfig.fields) {
        if (Array.isArray(searchConfig.fields)) {
          options.searchFields = searchConfig.fields;
        } else if (searchConfig.fields === true) {
          // All searchable fields
          const searchable: string[] = [];
          if (entityDef.fields) {
            for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
              const field = parseFieldDefinition(fieldName, fieldDef);
              if (field.api !== false && (field.type === "string" || field.type === "text")) {
                const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
                searchable.push(apiFieldName);
              }
            }
          }
          options.searchFields = searchable;
        }
      } else {
        // Default: all string/text fields (auto-detected)
        const searchable: string[] = [];
        if (entityDef.fields) {
          for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
            const field = parseFieldDefinition(fieldName, fieldDef);
            if (field.api !== false && (field.type === "string" || field.type === "text")) {
              const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
              searchable.push(apiFieldName);
            }
          }
        }
        options.searchFields = searchable;
      }
    }
  }

  // ===== Map query parameters to entity field filters =====
  // Match query param names to API field names
  for (const [queryKey, queryValue] of Object.entries(query)) {
    // Skip special query params
    if (["limit", "offset", "page", "pageSize", "cursor", "orderBy", "orderDirection", "search"].includes(queryKey)) {
      continue;
    }

    // Find matching entity field by API field name
    if (!entityDef.fields) {
      continue;
    }
    for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
      const field = parseFieldDefinition(fieldName, fieldDef);
      const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
      if (apiFieldName === queryKey) {
        options[apiFieldName] = queryValue;
        break;
      }
    }
  }

  return options;
}

/**
 * Resolve parameter reference (e.g., "query.limit" or "params.id")
 * 
 * Used in query handler configurations to reference request parameters.
 * Extracts values from context based on dot-notation references.
 * 
 * @param paramRef - Parameter reference string
 * @param context - Handler context containing request data
 * @returns Resolved parameter value or undefined if not found
 * 
 * @example
 * ```typescript
 * resolveParameter("query.search", context);
 * // Returns: context.query.search
 * 
 * resolveParameter("params.id", context);
 * // Returns: context.params.id
 * ```
 */
export function resolveParameter(
  paramRef: string,
  context: HandlerContext
): unknown {
  if (typeof paramRef !== "string") {
    return paramRef; // Already a direct value
  }

  const parts = paramRef.split(".");
  if (parts.length !== 2) {
    return undefined;
  }

  const [source, key] = parts;
  if (source === "query") {
    return context.query[key];
  } else if (source === "params") {
    return context.params[key];
  }

  return undefined;
}
