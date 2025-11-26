/**
 * Pagination type definitions for Yama
 */

/**
 * Supported pagination types
 */
export type PaginationType = "offset" | "page" | "cursor";

/**
 * Metadata fields that can be included in paginated responses
 */
export type PaginationMetadataField = "total" | "hasNext" | "hasPrev" | "nextCursor" | "prevCursor";

/**
 * Offset-based pagination configuration
 */
export interface OffsetPaginationConfig {
  type?: "offset"; // Optional, defaults to "offset"
  limit?: string | number; // Parameter reference (e.g., "query.limit") or direct number
  offset?: string | number; // Parameter reference (e.g., "query.offset") or direct number
  metadata?: PaginationMetadataField[]; // Optional: specify which metadata fields to include (default: all)
}

/**
 * Page-based pagination configuration
 */
export interface PagePaginationConfig {
  type: "page";
  page?: string | number; // Parameter reference (e.g., "query.page") or direct number
  pageSize?: string | number; // Parameter reference (e.g., "query.pageSize") or direct number (default: 20)
  metadata?: PaginationMetadataField[]; // Optional: specify which metadata fields to include (default: all)
}

/**
 * Cursor-based pagination configuration
 */
export interface CursorPaginationConfig {
  type: "cursor";
  cursor?: string; // Parameter reference (e.g., "query.cursor")
  cursorField?: string; // Field to use for cursor (default: primary key)
  limit?: string | number; // Parameter reference or direct number (default: 20)
  direction?: "forward" | "backward"; // Default: "forward"
  metadata?: PaginationMetadataField[]; // Optional: specify which metadata fields to include (default: all)
}

/**
 * Unified pagination configuration
 * Can be a boolean (shorthand for offset pagination) or a specific config object
 */
export type PaginationConfig =
  | boolean
  | OffsetPaginationConfig
  | PagePaginationConfig
  | CursorPaginationConfig;

/**
 * Normalized pagination configuration after processing
 */
export interface NormalizedPaginationConfig {
  type: PaginationType;
  limit: number;
  offset: number;
  cursorField?: string;
  cursorValue?: string | number;
  direction?: "forward" | "backward";
  metadata?: PaginationMetadataField[]; // Optional: specify which fields to include (default: all)
}

/**
 * Pagination metadata included in responses
 */
export interface PaginationMetadata {
  type: PaginationType;
  limit: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  total?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

