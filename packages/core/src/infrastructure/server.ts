import type { AuthContext } from "../schemas.js";
import type { CacheAdapter } from "./cache.js";
import type { StorageBucket } from "./storage.js";

/**
 * Normalized HTTP request interface
 */
export interface HttpRequest {
  method: string;
  url: string;
  path: string;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string | undefined>;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Normalized HTTP response interface
 */
export interface HttpResponse {
  status(code: number): HttpResponse;
  send(data: unknown): void;
  type(contentType: string): HttpResponse;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Handler context passed to route handlers
 * Provides a clean, single-parameter API for handlers
 */
export interface HandlerContext {
  // Request data
  method: string;
  url: string;
  path: string;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string | undefined>;
  
  // Authentication context
  auth?: AuthContext;
  
  // Response helpers
  status(code: number): HandlerContext;
  
  // Framework services (for future extensibility)
  db?: unknown; // Direct database adapter access
  entities?: Record<string, unknown>; // Entity repositories (e.g., context.entities.Product)
  cache?: CacheAdapter; // Cache adapter (Redis, Memcached, etc.)
  storage?: Record<string, StorageBucket>; // Storage buckets (e.g., context.storage.images, context.storage.documents)
  realtime?: {
    /**
     * Publish an event to a channel (throws on error)
     */
    publish(
      channel: string,
      event: string,
      data: unknown,
      options?: {
        userId?: string; // Send only to specific user
        excludeUserId?: string; // Send to all except this user
      }
    ): Promise<void>;
    
    /**
     * Publish an event to a channel (fire-and-forget, logs errors but doesn't throw)
     */
    publishAsync(
      channel: string,
      event: string,
      data: unknown,
      options?: {
        userId?: string;
        excludeUserId?: string;
      }
    ): void;
    
    /**
     * Broadcast an event to all clients in a channel
     */
    broadcast(
      channel: string,
      event: string,
      data: unknown,
      options?: {
        userId?: string;
        excludeUserId?: string;
      }
    ): Promise<void>;
    
    /**
     * Get connected clients for a channel
     * Returns user IDs or connection IDs
     */
    getClients(channel: string): Promise<string[]>;
    
    /**
     * Check if realtime is available
     */
    readonly available: boolean;
  };
  logger?: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
  
  // Original request/reply for edge cases
  _original?: {
    request: HttpRequest;
    reply: HttpResponse;
  };
  
  // Internal: status code set by handler (used by runtime)
  _statusCode?: number;
  
  [key: string]: unknown; // Allow additional properties
}

/**
 * Handler function type for user handlers
 * User handlers receive a single HandlerContext parameter
 */
export type HandlerFunction = (context: HandlerContext) => Promise<unknown> | unknown;

/**
 * Route handler function type for adapters
 * Adapters receive request/reply and convert them to context for user handlers
 */
export type RouteHandler = (request: HttpRequest, reply: HttpResponse) => Promise<unknown> | unknown;

/**
 * HTTP server instance (engine-specific)
 */
export type HttpServerInstance = unknown;

/**
 * HTTP server adapter interface - unified API for all HTTP engines
 */
export interface HttpServerAdapter {
  /**
   * Create a new HTTP server instance
   */
  createServer(options?: Record<string, unknown>): HttpServerInstance;

  /**
   * Register a route on the server
   */
  registerRoute(
    server: HttpServerInstance,
    method: string,
    path: string,
    handler: RouteHandler
  ): void;

  /**
   * Start the server
   */
  start(server: HttpServerInstance, port: number, host?: string): Promise<void>;

  /**
   * Stop the server
   */
  stop(server: HttpServerInstance): Promise<void>;

  /**
   * Get request adapter to normalize engine-specific request
   */
  getRequestAdapter(request: unknown): HttpRequest;

  /**
   * Get response adapter to normalize engine-specific response
   */
  getResponseAdapter(reply: unknown): HttpResponse;
}

/**
 * HTTP server adapter factory function type
 */
export type HttpServerAdapterFactory = (options?: Record<string, unknown>) => HttpServerAdapter;

/**
 * Registry of HTTP server adapters by engine
 */
const serverAdapters = new Map<string, HttpServerAdapterFactory>();

/**
 * Register an HTTP server adapter for a specific engine
 */
export function registerHttpServerAdapter(engine: string, factory: HttpServerAdapterFactory): void {
  serverAdapters.set(engine.toLowerCase(), factory);
}

/**
 * Create an HTTP server adapter for the given engine
 */
export function createHttpServerAdapter(
  engine: string = "fastify",
  options?: Record<string, unknown>
): HttpServerAdapter {
  const normalizedEngine = engine.toLowerCase();
  const factory = serverAdapters.get(normalizedEngine);

  if (!factory) {
    throw new Error(
      `Unsupported HTTP server engine: ${engine}. Supported engines: ${Array.from(serverAdapters.keys()).join(", ")}`
    );
  }

  return factory(options);
}


