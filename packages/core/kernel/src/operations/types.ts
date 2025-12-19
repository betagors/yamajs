
import { SchemaDefinition } from '@yamajs/kernel';

/**
 * The Standardized Operation Types
 * "The Single Source of Truth"
 */

// ============================================================================
// 1. OPERATION DEFINITION
// ============================================================================

export type OperationType = 'query' | 'mutation' | 'subscription';

export interface OperationDefinition<TInput = any, TOutput = any> {
  /**
   * Unique identifier for the operation (e.g., 'users.create', 'todos.list')
   */
  name: string;

  /**
   * Semantic type of the operation.
   * - query: Read-only, safe to cache.
   * - mutation: Write/Effect, not safe to cache.
   * - subscription: Long-lived stream of events.
   */
  type: OperationType;

  /**
   * Human-readable description for docs and AI context
   */
  description?: string;

  /**
   * Zod-compatible or JSON Schema definition for inputs.
   * Transport adapters will validate this before calling the handler.
   */
  input?: SchemaDefinition;

  /**
   * Zod-compatible or JSON Schema definition for outputs.
   * Used for generating SDK types and GraphQL schemas.
   */
  output?: SchemaDefinition;

  /**
   * Authorization requirements
   */
  auth?: {
    enabled?: boolean;
    roles?: string[];
    permissions?: string[];
    policy?: string; // Reference to a security policy
  };

  /**
   * Pagination Configuration
   * If defined, standard pagination logic is enforced.
   */
  pagination?: {
    enabled: boolean;
    defaultLimit?: number;
    maxLimit?: number;
  };

  /**
   * The core logic.
   * Must be transport-agnostic.
   */
  handler: OperationHandler<TInput, TOutput>;
}

// ============================================================================
// 2. CONTEXT & HANDLER
// ============================================================================

export interface OperationContext {
  /**
   * The Request ID (trace ID)
   */
  requestId: string;

  /**
   * Authenticated User (if any)
   */
  user?: any; // To be typed strictly with Auth module later

  /**
   * The raw runtime adapter (e.g. NodeRuntime) 
   * CAUTION: Use generic abstractions when possible.
   */
  runtime: any;

  /**
   * Logger formatted for this request context
   */
  logger: any;

  /**
   * Scoped services (DB transaction, etc)
   */
  scope?: Record<string, any>;
}

export type OperationHandler<TInput = any, TOutput = any> =
  (ctx: OperationContext, input: TInput) => Promise<TOutput> | AsyncIterable<TOutput>;


// ============================================================================
// 3. ABSTRACT RESULT ENVELOPE
// ============================================================================

export interface OperationResult<TData = unknown> {
  /**
   * Operation Success?
   */
  success: boolean;

  /**
   * The Payload (if success)
   */
  data?: TData;

  /**
   * Pagination Metadata (if paged)
   */
  pagination?: PaginationMeta;

  /**
   * Standardized Error (if failure)
   */
  error?: YamaError;

  /**
   * Tracing / Debug Metadata
   */
  meta?: Record<string, unknown>;
}

export interface YamaError {
  /**
   * Machine-readable error code (e.g. 'VALIDATION_FAILED', 'NOT_FOUND')
   */
  code: string;

  /**
   * Human-readable message
   */
  message: string;

  /**
   * Detailed validation errors or extra context
   */
  details?: unknown;

  /**
   * HTTP Status code hint (Transport adapters MAY use this, but logic shouldn't depend on it)
   */
  status?: number;
}


// ============================================================================
// 4. PAGINATION CONTRACTS
// ============================================================================

export interface PaginationInput {
  page?: number;     // 1-based index
  limit?: number;    // items per page
  cursor?: string;   // For cursor-based pagination
}

export interface PaginationMeta {
  total?: number;    // Total items available
  page?: number;     // Current page
  limit?: number;    // Current limit
  pages?: number;    // Total pages
  nextCursor?: string; // Next cursor for forward pagination
  prevCursor?: string; // Previous cursor
  hasMore?: boolean;   // Quick check if more items exist
}

// ============================================================================
// 5. LEGACY YAML CONFIG TYPES
// ============================================================================

export type OperationYamlDefinition = string | null | OperationConfig;

export interface OperationConfig {
  path?: string;
  parent?: string;
  input?: any;
  output?: any;
  auth?: any;
  description?: string;
  handler?: any;

  /**
   * REST Transporter configuration
   */
  rest?: boolean | RestOperationConfig;

  /**
   * GraphQL Transporter configuration
   */
  graphql?: boolean | GraphQLOperationConfig;

  /**
   * Policy to use for this operation
   */
  policy?: string;
}

export interface RestOperationConfig {
  /** HTTP Method (GET, POST, etc) */
  method?: string;
  /** Custom path (e.g., '/posts/:id/publish') */
  path?: string;
  /** Success status code */
  status?: number;
  /** Visibility (public, private, internal) */
  visibility?: string;
}

export interface GraphQLOperationConfig {
  /** GraphQL operation name */
  name?: string;
  /** GraphQL type (query, mutation, subscription) */
  type?: 'query' | 'mutation' | 'subscription';
}

export interface ParsedOperation {
  name: string;
  config: OperationConfig;
  method: string;
  path: string;
  entity: string;
  operationType: string;
}

export type YamaOperations = Record<string, OperationYamlDefinition>;

