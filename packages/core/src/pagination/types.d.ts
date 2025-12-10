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
    type?: "offset";
    limit?: string | number;
    offset?: string | number;
    metadata?: PaginationMetadataField[];
}
/**
 * Page-based pagination configuration
 */
export interface PagePaginationConfig {
    type: "page";
    page?: string | number;
    pageSize?: string | number;
    metadata?: PaginationMetadataField[];
}
/**
 * Cursor-based pagination configuration
 */
export interface CursorPaginationConfig {
    type: "cursor";
    cursor?: string;
    cursorField?: string;
    limit?: string | number;
    direction?: "forward" | "backward";
    metadata?: PaginationMetadataField[];
}
/**
 * Unified pagination configuration
 * Can be a boolean (shorthand for offset pagination) or a specific config object
 */
export type PaginationConfig = boolean | OffsetPaginationConfig | PagePaginationConfig | CursorPaginationConfig;
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
    metadata?: PaginationMetadataField[];
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
