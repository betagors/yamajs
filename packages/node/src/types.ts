/**
 * Type definitions for YAMA Node Runtime
 * 
 * This module contains all shared types and interfaces used across the runtime.
 */

import type {
  YamaSchemas,
  YamaEntities,
  AuthConfig,
  CrudConfig,
  DatabaseConfig,
  ServerConfig,
  PaginationConfig,
  RateLimitConfig,
  ApisConfig,
  HandlerContext,
  HandlerFunction,
  StorageBucket,
} from "@betagors/yama-core";

/**
 * Query handler configuration for declarative query endpoints
 * 
 * Allows defining query endpoints without writing custom handler code.
 * The runtime automatically maps query parameters to database filters.
 * 
 * @example
 * ```yaml
 * handler:
 *   type: query
 *   entity: Product
 *   filters:
 *     - field: name
 *       operator: ilike
 *       param: query.search
 *   pagination:
 *     type: offset
 *     limit: 20
 * ```
 */
export interface QueryHandlerConfig {
  /** Handler type identifier */
  type: 'query';
  
  /** Entity name to query */
  entity: string;
  
  /** Filter conditions to apply */
  filters?: Array<{
    /** Entity field name */
    field: string;
    /** Comparison operator (eq, ilike, gt, gte, lt, lte) */
    operator?: string;
    /** Parameter reference (e.g., "query.search", "params.id") */
    param?: string;
    /** Static filter value */
    value?: any;
  }>;
  
  /** Pagination configuration */
  pagination?: PaginationConfig;
  
  /** Ordering configuration */
  orderBy?: string | {
    field: string;
    direction?: 'asc' | 'desc';
  };
}

/**
 * Endpoint definition for REST API endpoints
 * 
 * Defines the structure of an API endpoint including path, method, handler,
 * validation rules, and security requirements.
 */
export interface EndpointDefinition {
  /** URL path pattern (supports parameters like /users/:id) */
  path: string;
  
  /** HTTP method (GET, POST, PUT, PATCH, DELETE) */
  method: string;
  
  /** Handler function reference (file path or query config) */
  handler?: string | QueryHandlerConfig;
  
  /** Human-readable endpoint description */
  description?: string;
  
  /** Query parameter schema definitions */
  query?: Record<string, any>;
  
  /** Path parameter schema definitions */
  params?: Record<string, any>;
  
  /** Request body schema (schema reference or inline definition) */
  body?: string | { type?: string; fields?: Record<string, any> };
  
  /** Response schema (schema reference or inline definition) */
  response?: string | { type?: string; properties?: Record<string, any> };
  
  /** Authentication and authorization configuration */
  auth?: {
    /** Whether authentication is required */
    required?: boolean;
    /** Required user roles */
    roles?: string[];
    /** Required permissions */
    permissions?: string[];
    /** Custom auth handler file path */
    handler?: string;
  };
  
  /** Rate limiting configuration */
  rateLimit?: any;
}

/**
 * YAMA runtime configuration
 * 
 * Main configuration object loaded from yama.yaml.
 * Contains all settings for the runtime including schemas, entities,
 * server configuration, plugins, and API definitions.
 */
export interface YamaConfig {
  /** Project name */
  name?: string;
  
  /** Project version */
  version?: string;
  
  /** Data schemas for validation */
  schemas?: YamaSchemas;
  
  /** Database entity definitions */
  entities?: YamaEntities;
  
  /** HTTP server configuration */
  server?: ServerConfig;
  
  /** Authentication configuration */
  auth?: AuthConfig;
  
  /** Global rate limiting configuration */
  rateLimit?: RateLimitConfig;
  
  /** Plugin configurations (array format) */
  plugins?: Record<string, Record<string, unknown>> | Array<string | Record<string, any>>;
  
  /** Legacy flat endpoints array (deprecated, use apis.rest instead) */
  endpoints?: EndpointDefinition[];
  
  /** Middleware configuration */
  middleware?: {
    /** Global middleware applied to all endpoints */
    global?: Array<{
      name: string;
      file?: string;
      phases?: Array<'pre-auth' | 'post-auth' | 'pre-handler' | 'post-handler' | 'error'>;
      priority?: number;
      enabled?: boolean;
      config?: Record<string, unknown>;
    }>;
    /** Endpoint-specific middleware */
    endpoints?: Array<{
      path: string;
      method?: string;
      middleware: Array<{
        name: string;
        file?: string;
        phases?: Array<'pre-auth' | 'post-auth' | 'pre-handler' | 'post-handler' | 'error'>;
        priority?: number;
        enabled?: boolean;
        config?: Record<string, unknown>;
      }>;
    }>;
  };
  
  /** Realtime/WebSocket configuration */
  realtime?: {
    /** Entity-level realtime events */
    entities?: Record<string, {
      enabled?: boolean;
      events?: ("created" | "updated" | "deleted")[];
      watchFields?: string[];
      channelPrefix?: string;
    }>;
    /** Custom realtime channels */
    channels?: Array<{
      name: string;
      path: string;
      auth?: {
        required?: boolean;
        handler?: string;
      };
      params?: Record<string, {
        type: string;
        required?: boolean;
      }>;
    }>;
  };
  
  /** Monitoring and observability configuration */
  monitoring?: {
    /** Log level (debug, info, warn, error) */
    level?: "debug" | "info" | "warn" | "error";
    /** Sampling configuration */
    sampling?: {
      /** Request sampling rate (0-1) */
      rate?: number;
      /** Error sampling rate (0-1, usually 1.0) */
      errors?: number;
    };
    /** Custom metrics definitions */
    custom?: Array<{
      name: string;
      type: "counter" | "gauge" | "histogram";
      description?: string;
    }>;
  };
  
  /** Protocol-agnostic API definitions (REST, GraphQL, etc.) */
  apis?: ApisConfig;
}

/**
 * YAMA server instance
 * 
 * Returned by startYamaNodeRuntime, provides control over the running server.
 */
export interface YamaServer {
  /** Stop the server and clean up resources */
  stop: () => Promise<void>;
  
  /** Port the server is listening on */
  port: number;
}

/**
 * Type guard to check if a handler config is a query handler
 */
export function isQueryHandler(handler: unknown): handler is QueryHandlerConfig {
  return handler !== null && typeof handler === 'object' && 'type' in handler && (handler as any).type === 'query';
}
