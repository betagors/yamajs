/**
 * Handler factory utilities for YAMA Node Runtime
 * 
 * This module creates handlers for endpoints, including:
 * - Query handlers (declarative query endpoints)
 * - Default handlers (auto-generated CRUD operations)
 */

import type {
  HandlerFunction,
  HandlerContext,
  YamaEntities,
  EntityDefinition,
} from "@betagors/yama-core";
import {
  parseFieldDefinition,
  normalizePaginationConfig,
  calculatePaginationMetadata,
  wrapPaginatedResponse,
  detectPaginationFromQuery,
} from "@betagors/yama-core";
import {
  NotFoundError,
  ValidationError,
  ConfigurationError,
  ErrorCodes,
} from "@betagors/yama-errors";
import type { EndpointDefinition, QueryHandlerConfig, YamaConfig } from "./types.js";
import { isQueryHandler } from "./types.js";
import { extractEntityNameFromResponseType, getPrimaryKeyFieldName, getApiFieldNameFromEntity } from "./entity-utils.js";
import { mapQueryToFindAllOptions, resolveParameter } from "./query-mapper.js";

/**
 * Create a query handler from endpoint configuration
 * 
 * Query handlers provide declarative query endpoints without custom code.
 * They automatically:
 * - Filter by entity fields
 * - Apply pagination
 * - Sort results
 * - Search across fields
 * 
 * @param endpoint - Endpoint definition containing query handler config
 * @param config - YAMA configuration
 * @param entities - Entity definitions
 * @returns Handler function that executes the query
 * 
 * @remarks
 * - Requires generated repositories (run `yama generate`)
 * - Supports eq and ilike operators (more coming)
 * - Pagination metadata is automatically included
 * 
 * @example
 * ```typescript
 * const handler = createQueryHandler({
 *   path: "/products",
 *   method: "GET",
 *   handler: {
 *     type: "query",
 *     entity: "Product",
 *     filters: [
 *       { field: "category", operator: "eq", param: "query.category" }
 *     ],
 *     pagination: { type: "offset", limit: 20 }
 *   }
 * }, config, entities);
 * ```
 */
export function createQueryHandler(
  endpoint: EndpointDefinition,
  config?: YamaConfig,
  entities?: YamaEntities
): HandlerFunction {
  return async (context: HandlerContext) => {
    // Handler config must be an object with type: "query"
    if (!isQueryHandler(endpoint.handler)) {
      throw new ConfigurationError("Invalid query handler configuration", {
        code: ErrorCodes.CONFIG_INVALID,
        context: { endpoint: endpoint.path },
      });
    }

    const handlerConfig = endpoint.handler as QueryHandlerConfig;
    const entityName = handlerConfig.entity;

    // Check if entity exists
    if (!entities || !entities[entityName]) {
      throw new ConfigurationError(`Entity "${entityName}" not found in configuration`, {
        code: ErrorCodes.CONFIG_SCHEMA,
        context: { entityName },
        suggestions: [
          `Add entity "${entityName}" to your yama.yaml schemas section`,
          `Check for typos in the entity name`,
        ],
      });
    }

    // Check if repository is available
    if (!context.entities || !context.entities[entityName]) {
      throw new ConfigurationError(`Repository for entity "${entityName}" not available`, {
        code: ErrorCodes.CONFIG_MISSING,
        context: { entityName },
        suggestions: [
          `Run 'yama generate' to generate repository files`,
          `Ensure a database plugin is configured`,
        ],
      });
    }

    const repository = context.entities[entityName] as any;
    const entityDef = entities[entityName];

    // Build findAll options
    const options: Record<string, unknown> = {};

    // ===== Process filters =====
    if (handlerConfig.filters && Array.isArray(handlerConfig.filters)) {
      const searchFields: string[] = [];
      let searchValue: string | undefined;

      for (const filter of handlerConfig.filters) {
        // Skip if no param reference defined
        if (!filter.param) {
          continue;
        }
        
        const paramValue = resolveParameter(filter.param, context);
        
        // Skip if parameter value is undefined or null
        if (paramValue === undefined || paramValue === null) {
          continue;
        }

        if (!entityDef.fields) {
          continue;
        }
        const fieldDef = entityDef.fields[filter.field];
        if (!fieldDef) {
          continue;
        }
        const field = parseFieldDefinition(filter.field, fieldDef);
        const apiFieldName = getApiFieldNameFromEntity(filter.field, field);

        if (filter.operator === "eq") {
          // Exact match - use direct field matching
          options[apiFieldName] = paramValue;
        } else if (filter.operator === "ilike") {
          // Case-insensitive contains - use search functionality
          // Collect search fields and use the first value as search term
          if (!searchValue) {
            searchValue = String(paramValue);
          }
          searchFields.push(apiFieldName);
        } else {
          // For other operators (gt, gte, lt, lte), we'd need repository extension
          // For MVP, log a warning and skip
          console.warn(
            `⚠️  Operator "${filter.operator}" not fully supported for field "${filter.field}" in query handler. Only "eq" and "ilike" are supported.`
          );
        }
      }

      // Apply search if we have search fields
      if (searchValue && searchFields.length > 0) {
        options.search = searchValue;
        options.searchFields = searchFields;
        options.searchMode = "contains";
      }
    }

    // ===== Process pagination =====
    let paginationMetadata: ReturnType<typeof calculatePaginationMetadata> | undefined;
    if (handlerConfig.pagination) {
      // Get primary key field for cursor pagination
      const primaryKeyField = getPrimaryKeyFieldName(entityDef);
      
      // Normalize pagination config
      const normalizedPagination = normalizePaginationConfig(
        handlerConfig.pagination,
        context,
        primaryKeyField,
        20 // default limit
      );

      if (normalizedPagination) {
        // Apply limit and offset to repository options
        options.limit = normalizedPagination.limit;
        options.offset = normalizedPagination.offset;

        // For cursor pagination, we need to handle it specially
        // Since repositories currently only support offset/limit, we'll convert cursor to offset
        // In a full implementation, repositories would support cursor-based queries natively
        if (normalizedPagination.type === "cursor" && normalizedPagination.cursorValue !== undefined) {
          // Note: Full cursor support would require repository-level changes
          // For now, we'll use offset-based pagination and let the repository handle it
          // The cursor value can be used for filtering if the repository supports it
          // This is a limitation - true cursor pagination needs repository support
        }
      }
    }

    // ===== Process orderBy =====
    if (handlerConfig.orderBy) {
      if (typeof handlerConfig.orderBy === "string") {
        // Reference to query parameter
        const orderByValue = resolveParameter(handlerConfig.orderBy, context);
        if (orderByValue) {
          const orderByStr = String(orderByValue);
          if (orderByStr.includes(":")) {
            // Format: field:direction
            const [field, direction] = orderByStr.split(":");
            options.orderBy = {
              field: field.trim(),
              direction: (direction?.trim().toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc",
            };
          } else {
            // Just field name
            options.orderBy = {
              field: orderByStr,
            };
          }
        }
      } else {
        // Direct object configuration
        options.orderBy = {
          field: handlerConfig.orderBy.field,
          direction: handlerConfig.orderBy.direction || "asc",
        };
      }
    }

    // Call repository.findAll with built options
    const results = await repository.findAll(options);

    // Handle pagination metadata wrapping (always wrap when pagination is enabled)
    if (handlerConfig.pagination) {
      const primaryKeyField = getPrimaryKeyFieldName(entityDef);
      const normalizedPagination = normalizePaginationConfig(
        handlerConfig.pagination,
        context,
        primaryKeyField,
        20
      );

      if (normalizedPagination) {
        // Always calculate and wrap metadata when pagination is enabled
        paginationMetadata = calculatePaginationMetadata(
          normalizedPagination,
          results as unknown[],
          undefined // total count - would require a separate COUNT query
        );

        return wrapPaginatedResponse(
          results as unknown[],
          paginationMetadata,
          normalizedPagination.metadata
        );
      }
    }

    return results;
  };
}

/**
 * Create default handler for CRUD endpoints
 * 
 * Default handlers automatically provide CRUD operations for entities
 * without requiring custom handler code. They:
 * - Detect entity from response type
 * - Map HTTP methods to repository operations
 * - Handle pagination and filtering
 * - Provide helpful error messages
 * 
 * Supported operations:
 * - GET /path → list (findAll with pagination/filtering)
 * - GET /path/:id → get single (findById)
 * - POST /path → create
 * - PUT /path/:id → full update
 * - PATCH /path/:id → partial update
 * - DELETE /path/:id → delete
 * 
 * @param endpoint - Endpoint definition
 * @param responseType - Expected response type (entity name or Entity[])
 * @param config - YAMA configuration
 * @param entities - Entity definitions
 * @returns Handler function
 * 
 * @remarks
 * - Returns placeholder if no response type specified
 * - Requires generated repositories for entity operations
 * - Automatically sets appropriate status codes
 * 
 * @example
 * ```typescript
 * // Endpoint: GET /products
 * // Response type: Product[]
 * // Auto-generates handler that calls productRepository.findAll()
 * 
 * const handler = createDefaultHandler(
 *   { path: "/products", method: "GET" },
 *   "Product[]",
 *   config,
 *   entities
 * );
 * ```
 */
export function createDefaultHandler(
  endpoint: EndpointDefinition,
  responseType?: string,
  config?: YamaConfig,
  entities?: YamaEntities
): HandlerFunction {
  return async (context: HandlerContext) => {
    // If no response type, return placeholder message
    if (!responseType) {
      return {
        message: `Endpoint ${endpoint.method} ${endpoint.path} is configured but no handler is implemented`,
        path: endpoint.path,
        method: endpoint.method,
      };
    }

    // Try to detect entity from response type
    if (entities && config) {
      const entityName = extractEntityNameFromResponseType(responseType, entities);
      console.log(`🔍 createDefaultHandler: responseType="${responseType}", entityName="${entityName}"`);
      console.log(`🔍 Available entities in context:`, context.entities ? Object.keys(context.entities) : 'none');
      console.log(`🔍 Available entities in config:`, entities ? Object.keys(entities) : 'none');
      
      if (entityName && context.entities && context.entities[entityName]) {
        const repository = context.entities[entityName] as any;
        const entityDef = entities[entityName];
        const method = endpoint.method.toUpperCase();
        console.log(`✅ Found repository for ${entityName}, method=${method}`);

        try {
          // ===== GET /path (list) =====
          // Expects Entity[] response (array syntax)
          const isArrayResponse = responseType.endsWith("[]");
          if (method === "GET" && isArrayResponse) {
            const options = mapQueryToFindAllOptions(context.query, entityDef, entities?.[entityName]);
            const results = await repository.findAll(options);
            
            // Detect pagination and wrap with metadata if present
            const detectedPagination = detectPaginationFromQuery(context.query);
            if (detectedPagination) {
              const metadata = calculatePaginationMetadata(
                detectedPagination,
                results as unknown[],
                undefined // total count - would require a separate COUNT query
              );
              // Always wrap with metadata (better DX)
              return wrapPaginatedResponse(results as unknown[], metadata);
            }
            
            return results;
          }

          // ===== GET /path/:id (single) =====
          // Expects Entity response (not array)
          if (method === "GET" && !isArrayResponse) {
            // Extract primary key from params
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new ValidationError(`Missing required parameter: ${primaryKey}`, {
                code: ErrorCodes.VALIDATION_PARAMS,
                details: [{ field: primaryKey, message: 'Required parameter is missing' }],
              });
            }

            const result = await repository.findById(String(id));
            if (!result) {
              throw new NotFoundError(`${entityName} not found`, {
                code: ErrorCodes.NOT_FOUND_ENTITY,
                context: { entityType: entityName, id: String(id) },
              });
            }
            return result;
          }

          // ===== POST /path =====
          // Create entity
          if (method === "POST") {
            if (!context.body) {
              throw new ValidationError("Request body is required", {
                code: ErrorCodes.VALIDATION_BODY,
                details: [{ message: 'Request body cannot be empty' }],
              });
            }
            console.log(`📤 Creating ${entityName} with body:`, JSON.stringify(context.body, null, 2));
            const result = await repository.create(context.body);
            console.log(`📥 Repository.create returned:`, JSON.stringify(result, null, 2));
            if (!result) {
              throw new Error(`Failed to create ${entityName}: repository returned null/undefined`);
            }
            context.status(201);
            return result;
          }

          // ===== PUT /path/:id =====
          // Full update
          if (method === "PUT") {
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new ValidationError(`Missing required parameter: ${primaryKey}`, {
                code: ErrorCodes.VALIDATION_PARAMS,
                details: [{ field: primaryKey, message: 'Required parameter is missing' }],
              });
            }
            if (!context.body) {
              throw new ValidationError("Request body is required", {
                code: ErrorCodes.VALIDATION_BODY,
                details: [{ message: 'Request body cannot be empty' }],
              });
            }

            const result = await repository.update(String(id), context.body);
            if (!result) {
              throw new NotFoundError(`${entityName} not found`, {
                code: ErrorCodes.NOT_FOUND_ENTITY,
                context: { entityType: entityName, id: String(id) },
              });
            }
            return result;
          }

          // ===== PATCH /path/:id =====
          // Partial update
          if (method === "PATCH") {
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new ValidationError(`Missing required parameter: ${primaryKey}`, {
                code: ErrorCodes.VALIDATION_PARAMS,
                details: [{ field: primaryKey, message: 'Required parameter is missing' }],
              });
            }
            if (!context.body) {
              throw new ValidationError("Request body is required", {
                code: ErrorCodes.VALIDATION_BODY,
                details: [{ message: 'Request body cannot be empty' }],
              });
            }

            const result = await repository.update(String(id), context.body);
            if (!result) {
              throw new NotFoundError(`${entityName} not found`, {
                code: ErrorCodes.NOT_FOUND_ENTITY,
                context: { entityType: entityName, id: String(id) },
              });
            }
            return result;
          }

          // ===== DELETE /path/:id =====
          if (method === "DELETE") {
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new ValidationError(`Missing required parameter: ${primaryKey}`, {
                code: ErrorCodes.VALIDATION_PARAMS,
                details: [{ field: primaryKey, message: 'Required parameter is missing' }],
              });
            }

            const deleted = await repository.delete(String(id));
            if (!deleted) {
              throw new NotFoundError(`${entityName} not found`, {
                code: ErrorCodes.NOT_FOUND_ENTITY,
                context: { entityType: entityName, id: String(id) },
              });
            }
            context.status(204);
            return undefined;
          }
        } catch (error) {
          // If repository method fails, re-throw to be caught by error handler
          throw error;
        }
      }
    }

    // Fallback: return empty object if response type is specified but entity not found
    // This allows validation to pass but indicates the endpoint needs a handler
    return {};
  };
}

/**
 * Get response type from endpoint response definition
 * 
 * @param response - Response definition (string, object with type, or object with properties)
 * @returns Response type string or undefined
 */
export function getResponseType(response: { type?: string } | { properties?: Record<string, any> } | string | undefined): string | undefined {
  if (!response) return undefined;
  if (typeof response === 'string') return response;
  if ('type' in response && response.type) return response.type;
  return undefined;
}
