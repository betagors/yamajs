/**
 * Pagination utility functions for Yama
 */

import type { HandlerContext } from "../infrastructure/server.js";
import type {
  PaginationConfig,
  NormalizedPaginationConfig,
  PaginationMetadata,
  PaginationMetadataField,
  PaginationType,
  PaginatedResponse,
} from "./types.js";

/**
 * Resolve a parameter reference (e.g., "query.limit" or "params.id")
 * Returns the value from context or undefined if not found
 */
function resolveParameter(paramRef: string | number, context: HandlerContext): unknown {
  if (typeof paramRef === "number") {
    return paramRef; // Already a direct value
  }

  if (typeof paramRef !== "string") {
    return undefined;
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

/**
 * Convert a value to a number, returning undefined if invalid
 */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return isNaN(value) ? undefined : value;
  }
  if (typeof value === "string") {
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Convert page and pageSize to offset and limit
 */
export function pageToOffset(page: number, pageSize: number): { offset: number; limit: number } {
  const pageNum = Math.max(1, page); // Ensure page is at least 1
  const pageSizeNum = Math.max(1, pageSize); // Ensure pageSize is at least 1
  return {
    offset: (pageNum - 1) * pageSizeNum,
    limit: pageSizeNum,
  };
}

/**
 * Normalize pagination configuration to a standard form
 */
export function normalizePaginationConfig(
  config: PaginationConfig | undefined,
  context: HandlerContext,
  primaryKeyField: string = "id",
  defaultLimit: number = 20
): NormalizedPaginationConfig | undefined {
  // If no config, return undefined (no pagination)
  if (!config) {
    return undefined;
  }

  // Handle boolean shorthand: pagination: true
  if (config === true) {
    return {
      type: "offset",
      limit: defaultLimit,
      offset: 0,
      metadata: undefined, // Default: include all metadata
    };
  }

  // Handle offset pagination (default or explicit)
  if (!config.type || config.type === "offset") {
    const limit = config.limit !== undefined
      ? toNumber(resolveParameter(config.limit, context)) ?? defaultLimit
      : defaultLimit;
    const offset = config.offset !== undefined
      ? toNumber(resolveParameter(config.offset, context)) ?? 0
      : 0;

    return {
      type: "offset",
      limit: Math.max(1, limit),
      offset: Math.max(0, offset),
      metadata: Array.isArray(config.metadata) ? config.metadata : undefined,
    };
  }

  // Handle page pagination
  if (config.type === "page") {
    const pageSize = config.pageSize !== undefined
      ? toNumber(resolveParameter(config.pageSize, context)) ?? defaultLimit
      : defaultLimit;
    const page = config.page !== undefined
      ? toNumber(resolveParameter(config.page, context)) ?? 1
      : 1;

    const { offset, limit } = pageToOffset(page, pageSize);

    return {
      type: "page",
      limit,
      offset,
      metadata: Array.isArray(config.metadata) ? config.metadata : undefined,
    };
  }

  // Handle cursor pagination
  if (config.type === "cursor") {
    const limit = config.limit !== undefined
      ? toNumber(resolveParameter(config.limit, context)) ?? defaultLimit
      : defaultLimit;
    const rawCursorValue = config.cursor !== undefined
      ? resolveParameter(config.cursor, context)
      : undefined;
    // Convert cursor value to string | number | undefined
    const cursorValue: string | number | undefined = rawCursorValue === undefined
      ? undefined
      : typeof rawCursorValue === "string" || typeof rawCursorValue === "number"
      ? rawCursorValue
      : String(rawCursorValue);
    const cursorField = config.cursorField || primaryKeyField;
    const direction = config.direction || "forward";

    // For cursor pagination, we need to find the offset based on the cursor value
    // This is a simplified implementation - in practice, you'd query the database
    // to find the position of the cursor value. For now, we'll set offset to 0
    // and let the repository handle cursor-based queries if it supports them.
    // Otherwise, we'll need to fetch all records up to cursor and count.
    // This is a limitation - full cursor support requires repository-level changes.
    const offset = 0; // Will be handled by cursor logic in repository if supported

    return {
      type: "cursor",
      limit: Math.max(1, limit),
      offset,
      cursorField,
      cursorValue,
      direction,
      metadata: Array.isArray(config.metadata) ? config.metadata : undefined,
    };
  }

  return undefined;
}

/**
 * Calculate pagination metadata for a response
 */
export function calculatePaginationMetadata(
  normalizedConfig: NormalizedPaginationConfig,
  results: unknown[],
  totalCount?: number
): PaginationMetadata {
  const metadata: PaginationMetadata = {
    type: normalizedConfig.type,
    limit: normalizedConfig.limit,
  };

  if (normalizedConfig.type === "offset") {
    metadata.offset = normalizedConfig.offset;
    if (totalCount !== undefined) {
      metadata.total = totalCount;
      metadata.hasNext = normalizedConfig.offset + normalizedConfig.limit < totalCount;
      metadata.hasPrev = normalizedConfig.offset > 0;
    } else {
      // Estimate based on results length
      metadata.hasNext = results.length === normalizedConfig.limit;
      metadata.hasPrev = normalizedConfig.offset > 0;
    }
  } else if (normalizedConfig.type === "page") {
    const page = Math.floor(normalizedConfig.offset / normalizedConfig.limit) + 1;
    const pageSize = normalizedConfig.limit;
    metadata.page = page;
    metadata.pageSize = pageSize;
    if (totalCount !== undefined) {
      metadata.total = totalCount;
      const totalPages = Math.ceil(totalCount / pageSize);
      metadata.hasNext = page < totalPages;
      metadata.hasPrev = page > 1;
    } else {
      // Estimate based on results length
      metadata.hasNext = results.length === normalizedConfig.limit;
      metadata.hasPrev = page > 1;
    }
  } else if (normalizedConfig.type === "cursor") {
    // For cursor pagination, nextCursor is the last item's cursor field value
    if (results.length > 0 && normalizedConfig.cursorField) {
      const lastItem = results[results.length - 1] as Record<string, unknown>;
      const cursorValue = lastItem[normalizedConfig.cursorField];
      if (cursorValue !== undefined) {
        metadata.nextCursor = String(cursorValue);
      }
    }
    // hasNext is true if we got a full page of results
    metadata.hasNext = results.length === normalizedConfig.limit;
    // hasPrev requires knowing the previous cursor, which we'd need to track
    // For now, we'll leave it undefined
  }

  return metadata;
}

/**
 * Check if metadata should be included based on config
 * 
 * If array is provided, only include fields in the array.
 * Otherwise, include all fields.
 */
function shouldIncludeMetadata(
  metadataConfig: boolean | PaginationMetadataField[] | undefined,
  field: PaginationMetadataField
): boolean {
  // If array provided, check if field is in array
  if (Array.isArray(metadataConfig)) {
    return metadataConfig.includes(field);
  }
  // Default: include all fields
  return true;
}

/**
 * Filter metadata to only include requested fields
 */
export function filterMetadata(
  metadata: PaginationMetadata,
  metadataConfig?: PaginationMetadataField[]
): PaginationMetadata {
  // If no config or empty array, return all metadata
  if (!metadataConfig || metadataConfig.length === 0) {
    return metadata;
  }

  const filtered: PaginationMetadata = {
    type: metadata.type,
    limit: metadata.limit,
  };

  if (shouldIncludeMetadata(metadataConfig, "total") && metadata.total !== undefined) {
    filtered.total = metadata.total;
  }
  if (shouldIncludeMetadata(metadataConfig, "hasNext") && metadata.hasNext !== undefined) {
    filtered.hasNext = metadata.hasNext;
  }
  if (shouldIncludeMetadata(metadataConfig, "hasPrev") && metadata.hasPrev !== undefined) {
    filtered.hasPrev = metadata.hasPrev;
  }
  if (shouldIncludeMetadata(metadataConfig, "nextCursor") && metadata.nextCursor !== undefined) {
    filtered.nextCursor = metadata.nextCursor;
  }
  if (shouldIncludeMetadata(metadataConfig, "prevCursor") && metadata.prevCursor !== undefined) {
    filtered.prevCursor = metadata.prevCursor;
  }
  if (metadata.offset !== undefined) {
    filtered.offset = metadata.offset;
  }
  if (metadata.page !== undefined) {
    filtered.page = metadata.page;
  }
  if (metadata.pageSize !== undefined) {
    filtered.pageSize = metadata.pageSize;
  }

  return filtered;
}

/**
 * Wrap paginated results with metadata
 * Always wraps responses with metadata for better DX.
 */
export function wrapPaginatedResponse<T>(
  results: T[],
  metadata: PaginationMetadata,
  metadataConfig?: boolean | PaginationMetadataField[]
): PaginatedResponse<T> {
  // Always wrap with metadata - filter to requested fields if array provided
  // Convert boolean to undefined (false = no metadata, true = all metadata)
  const metadataFields: PaginationMetadataField[] | undefined = 
    typeof metadataConfig === "boolean" 
      ? undefined // Let filterMetadata handle boolean logic (undefined = all fields)
      : metadataConfig;
  const filteredMetadata = filterMetadata(metadata, metadataFields);

  return {
    data: results,
    pagination: filteredMetadata,
  };
}

/**
 * Extract pagination config from query params (for default handlers)
 * Detects pagination type based on available query parameters
 */
export function detectPaginationFromQuery(
  query: Record<string, unknown>,
  defaultLimit: number = 20
): NormalizedPaginationConfig | undefined {
  // Check for cursor pagination first (most specific)
  if (query.cursor !== undefined) {
    const limit = query.limit !== undefined ? toNumber(query.limit) ?? defaultLimit : defaultLimit;
    // Convert cursor to string | number | undefined
    const rawCursor = query.cursor;
    const cursorValue: string | number | undefined = rawCursor === undefined || rawCursor === null
      ? undefined
      : typeof rawCursor === "string" || typeof rawCursor === "number"
      ? rawCursor
      : String(rawCursor);
    return {
      type: "cursor",
      limit: Math.max(1, limit),
      offset: 0, // Cursor pagination doesn't use offset directly
      cursorValue,
      cursorField: "id", // Default, can be overridden
    };
  }

  // Check for page pagination
  if (query.page !== undefined) {
    const page = toNumber(query.page) ?? 1;
    const pageSize = query.pageSize !== undefined
      ? toNumber(query.pageSize) ?? defaultLimit
      : defaultLimit;
    const { offset, limit } = pageToOffset(page, pageSize);
    return {
      type: "page",
      limit,
      offset,
    };
  }

  // Default to offset pagination
  if (query.limit !== undefined || query.offset !== undefined) {
    const limit = query.limit !== undefined ? toNumber(query.limit) ?? defaultLimit : defaultLimit;
    const offset = query.offset !== undefined ? toNumber(query.offset) ?? 0 : 0;
    return {
      type: "offset",
      limit: Math.max(1, limit),
      offset: Math.max(0, offset),
    };
  }

  return undefined;
}

