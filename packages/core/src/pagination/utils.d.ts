/**
 * Pagination utility functions for Yama
 */
import type { HandlerContext } from "../infrastructure/server.js";
import type { PaginationConfig, NormalizedPaginationConfig, PaginationMetadata, PaginationMetadataField, PaginatedResponse } from "./types.js";
/**
 * Convert page and pageSize to offset and limit
 */
export declare function pageToOffset(page: number, pageSize: number): {
    offset: number;
    limit: number;
};
/**
 * Normalize pagination configuration to a standard form
 */
export declare function normalizePaginationConfig(config: PaginationConfig | undefined, context: HandlerContext, primaryKeyField?: string, defaultLimit?: number): NormalizedPaginationConfig | undefined;
/**
 * Calculate pagination metadata for a response
 */
export declare function calculatePaginationMetadata(normalizedConfig: NormalizedPaginationConfig, results: unknown[], totalCount?: number): PaginationMetadata;
/**
 * Filter metadata to only include requested fields
 */
export declare function filterMetadata(metadata: PaginationMetadata, metadataConfig?: PaginationMetadataField[]): PaginationMetadata;
/**
 * Wrap paginated results with metadata
 * Always wraps responses with metadata for better DX.
 */
export declare function wrapPaginatedResponse<T>(results: T[], metadata: PaginationMetadata, metadataConfig?: boolean | PaginationMetadataField[]): PaginatedResponse<T>;
/**
 * Extract pagination config from query params (for default handlers)
 * Detects pagination type based on available query parameters
 */
export declare function detectPaginationFromQuery(query: Record<string, unknown>, defaultLimit?: number): NormalizedPaginationConfig | undefined;
