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
    [key: string]: unknown;
}
/**
 * Normalized HTTP response interface
 */
export interface HttpResponse {
    status(code: number): HttpResponse;
    send(data: unknown): void;
    type(contentType: string): HttpResponse;
    [key: string]: unknown;
}
/**
 * Handler context passed to route handlers
 * Provides a clean, single-parameter API for handlers
 */
export interface HandlerContext {
    method: string;
    url: string;
    path: string;
    query: Record<string, unknown>;
    params: Record<string, unknown>;
    body: unknown;
    headers: Record<string, string | undefined>;
    auth?: AuthContext;
    status(code: number): HandlerContext;
    db?: unknown;
    entities?: Record<string, unknown>;
    cache?: CacheAdapter;
    storage?: Record<string, StorageBucket>;
    email?: {
        /**
         * Send an email
         */
        send(options: {
            to: string | string[];
            cc?: string | string[];
            bcc?: string | string[];
            subject: string;
            text?: string;
            html?: string;
            attachments?: Array<{
                filename?: string;
                path?: string;
                content?: Buffer | string;
                contentType?: string;
                cid?: string;
            }>;
            replyTo?: string | string[];
            from?: string;
            headers?: Record<string, string>;
        }): Promise<{
            messageId: string;
            accepted: string[];
            rejected: string[];
            response?: string;
        }>;
        /**
         * Send multiple emails in batch
         */
        sendBatch(emails: Array<{
            to: string | string[];
            cc?: string | string[];
            bcc?: string | string[];
            subject: string;
            text?: string;
            html?: string;
            attachments?: Array<{
                filename?: string;
                path?: string;
                content?: Buffer | string;
                contentType?: string;
                cid?: string;
            }>;
            replyTo?: string | string[];
            from?: string;
            headers?: Record<string, string>;
        }>): Promise<Array<{
            messageId: string;
            accepted: string[];
            rejected: string[];
            response?: string;
        }>>;
    };
    realtime?: {
        /**
         * Publish an event to a channel (throws on error)
         */
        publish(channel: string, event: string, data: unknown, options?: {
            userId?: string;
            excludeUserId?: string;
        }): Promise<void>;
        /**
         * Publish an event to a channel (fire-and-forget, logs errors but doesn't throw)
         */
        publishAsync(channel: string, event: string, data: unknown, options?: {
            userId?: string;
            excludeUserId?: string;
        }): void;
        /**
         * Broadcast an event to all clients in a channel
         */
        broadcast(channel: string, event: string, data: unknown, options?: {
            userId?: string;
            excludeUserId?: string;
        }): Promise<void>;
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
        /**
         * Log an info message with optional metadata
         */
        info(message: string, meta?: Record<string, unknown>): void;
        /**
         * Log a warning message with optional metadata
         */
        warn(message: string, meta?: Record<string, unknown>): void;
        /**
         * Log an error message with optional error and metadata
         */
        error(message: string, error?: Error, meta?: Record<string, unknown>): void;
        /**
         * Log a debug message with optional metadata
         */
        debug(message: string, meta?: Record<string, unknown>): void;
    };
    metrics?: {
        /**
         * Increment a counter metric
         */
        increment(name: string, value?: number, tags?: Record<string, string>): void;
        /**
         * Record a histogram value
         */
        histogram(name: string, value: number, tags?: Record<string, string>): void;
        /**
         * Set a gauge value
         */
        gauge(name: string, value: number, tags?: Record<string, string>): void;
    };
    tracing?: {
        /**
         * Start a trace span (for future tracing support)
         */
        startSpan(name: string): TraceSpan;
        /**
         * Get the current active span
         */
        getCurrentSpan(): TraceSpan | undefined;
    };
    _original?: {
        request: HttpRequest;
        reply: HttpResponse;
    };
    _statusCode?: number;
    [key: string]: unknown;
}
/**
 * Trace span interface (for future tracing support)
 */
export interface TraceSpan {
    /**
     * Set a tag on the span
     */
    setTag(key: string, value: string | number | boolean): void;
    /**
     * Add an event to the span
     */
    addEvent(name: string, attributes?: Record<string, unknown>): void;
    /**
     * Finish the span
     */
    finish(): void;
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
    registerRoute(server: HttpServerInstance, method: string, path: string, handler: RouteHandler): void;
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
 * Register an HTTP server adapter for a specific engine
 */
export declare function registerHttpServerAdapter(engine: string, factory: HttpServerAdapterFactory): void;
/**
 * Create an HTTP server adapter for the given engine
 */
export declare function createHttpServerAdapter(engine?: string, options?: Record<string, unknown>): HttpServerAdapter;
