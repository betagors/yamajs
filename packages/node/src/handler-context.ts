/**
 * Handler context creation utilities for YAMA Node Runtime
 * 
 * This module creates the context object that handlers receive,
 * providing access to request data, database, cache, storage, etc.
 */

import type {
  HttpRequest,
  HttpResponse,
  AuthContext,
  HandlerContext,
  StorageBucket,
} from "@betagors/yama-core";
import { enhanceAuthContext } from "@betagors/yama-core";

/**
 * Create a handler context from request and reply
 * 
 * Builds a comprehensive context object that handlers receive, including:
 * - Request data (method, url, path, query, params, body, headers)
 * - Authentication context (user, roles, permissions)
 * - Database access (db adapter, entity repositories)
 * - Cache access
 * - Storage buckets (file/object storage)
 * - Realtime/WebSocket publish methods
 * - Email service
 * - Logger service
 * - Metrics service
 * - Status helper for setting HTTP status codes
 * 
 * @param request - HTTP request object
 * @param reply - HTTP response object
 * @param authContext - Authentication context (if authenticated)
 * @param repositories - Entity repositories map
 * @param dbAdapter - Database adapter instance
 * @param cacheAdapter - Cache adapter instance
 * @param storage - Storage buckets map
 * @param realtimeAdapter - Realtime/WebSocket adapter
 * @param emailService - Email service instance
 * @param loggerService - Logger service instance
 * @param metricsService - Metrics service instance
 * @returns Handler context object
 * 
 * @remarks
 * - Entities proxy provides helpful error messages if repositories aren't generated
 * - Services are optional and only included if plugins are configured
 * - Status helper can be chained: `context.status(201).send(result)`
 * 
 * @example
 * ```typescript
 * const context = createHandlerContext(
 *   request,
 *   reply,
 *   authContext,
 *   repositories,
 *   dbAdapter
 * );
 * 
 * // In handler:
 * const users = await context.entities.User.findAll({ limit: 10 });
 * context.logger?.info("Fetched users", { count: users.length });
 * return context.status(200).send(users);
 * ```
 */
export function createHandlerContext(
  request: HttpRequest,
  reply: HttpResponse,
  authContext?: AuthContext,
  repositories?: Record<string, unknown>,
  dbAdapter?: unknown,
  cacheAdapter?: unknown,
  storage?: Record<string, StorageBucket>,
  realtimeAdapter?: unknown,
  emailService?: any,
  loggerService?: any,
  metricsService?: any,
  requestId?: string,
  rolePermissions?: Record<string, string[]>
): HandlerContext {
  let statusCode: number | undefined;
  
  // Enhance auth context with permission helpers (can, hasRole, canAny, canAll)
  const enhancedAuth = authContext 
    ? enhanceAuthContext(authContext, rolePermissions || {})
    : undefined;
  
  // Create a proxy for entities that provides better error messages
  // This helps developers understand when repositories haven't been generated
  const entitiesProxy = repositories && Object.keys(repositories).length > 0 
    ? new Proxy(repositories, {
        get(target, prop: string | symbol) {
          if (typeof prop === 'string' && !(prop in target)) {
            throw new Error(
              `Entity repository "${prop}" is not available. ` +
              `This usually means the database code hasn't been generated yet. ` +
              `Run 'yama generate' to generate the repository files. ` +
              `If you've already run 'yama generate', ensure that:\n` +
              `  1. The entity "${prop}" is defined in your yama.yaml\n` +
              `  2. A database plugin is installed and configured\n` +
              `  3. The generated files exist at .yama/gen/db/index.ts`
            );
          }
          return target[prop as string];
        }
      })
    : repositories || new Proxy({} as Record<string, unknown>, {
        get(_target, prop: string | symbol) {
          if (typeof prop === 'string') {
            throw new Error(
              `Entity repository "${prop}" is not available. ` +
              `Database repositories have not been generated. ` +
              `Run 'yama generate' to generate the repository files.`
            );
          }
          return undefined;
        }
      });
  
  const context: HandlerContext = {
    // ===== Request data =====
    method: request.method,
    url: request.url,
    path: request.path,
    query: request.query,
    params: request.params,
    body: request.body,
    headers: request.headers,
    
    // ===== Request identification =====
    requestId: requestId,
    
    // ===== Auth context (enhanced with can(), hasRole(), etc.) =====
    auth: enhancedAuth,
    
    // ===== Database access =====
    db: dbAdapter,
    entities: entitiesProxy,
    
    // ===== Cache access =====
    cache: cacheAdapter as any,
    
    // ===== Storage access =====
    storage: storage,
    
    // ===== Realtime access =====
    realtime: realtimeAdapter ? {
      /** Publish event to channel and wait for completion */
      publish: async (channel: string, event: string, data: unknown, options?: { userId?: string; excludeUserId?: string }) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.publish === "function") {
          return await adapter.publish(channel, event, data, options);
        }
        throw new Error("Realtime adapter not available");
      },
      /** Publish event to channel without waiting (fire-and-forget) */
      publishAsync: (channel: string, event: string, data: unknown, options?: { userId?: string; excludeUserId?: string }) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.publishAsync === "function") {
          adapter.publishAsync(channel, event, data, options);
        }
      },
      /** Broadcast event to all clients in channel */
      broadcast: async (channel: string, event: string, data: unknown, options?: { userId?: string; excludeUserId?: string }) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.broadcast === "function") {
          return await adapter.broadcast(channel, event, data, options);
        }
        throw new Error("Realtime adapter not available");
      },
      /** Get list of connected clients in channel */
      getClients: async (channel: string) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.getClients === "function") {
          return await adapter.getClients(channel);
        }
        return [];
      },
      /** Check if realtime is available */
      get available() {
        return realtimeAdapter !== null && realtimeAdapter !== undefined;
      },
    } : undefined,
    
    // ===== Email access =====
    email: emailService ? {
      /** Send single email */
      send: emailService.send.bind(emailService),
      /** Send batch of emails */
      sendBatch: emailService.sendBatch.bind(emailService),
    } : undefined,
    
    // ===== Logger access (from logging plugin) =====
    // Logger automatically includes requestId in all log calls for tracing
    logger: loggerService ? {
      info: (message: string, meta?: Record<string, unknown>) => {
        loggerService.info(message, { ...meta, requestId });
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
        loggerService.warn(message, { ...meta, requestId });
      },
      error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
        loggerService.error(message, error, { ...meta, requestId });
      },
      debug: (message: string, meta?: Record<string, unknown>) => {
        loggerService.debug(message, { ...meta, requestId });
      },
    } : undefined,
    
    // ===== Metrics access (from metrics plugin) =====
    metrics: metricsService ? {
      /** Increment counter metric */
      increment: (name: string, value?: number, tags?: Record<string, string>) => {
        // Convert tags object to labels array format expected by metrics plugin
        const labels = tags ? Object.keys(tags) : [];
        const counter = metricsService.registerCounter(name, labels);
        const labelValues = tags ? Object.values(tags) : [];
        counter.inc(value || 1, labelValues);
      },
      /** Record histogram/duration metric */
      histogram: (name: string, value: number, tags?: Record<string, string>) => {
        const labels = tags ? Object.keys(tags) : [];
        const histogram = metricsService.registerHistogram(name, labels);
        const labelValues = tags ? Object.values(tags) : [];
        histogram.observe(value, labelValues);
      },
      /** Set gauge metric value */
      gauge: (name: string, value: number, tags?: Record<string, string>) => {
        const labels = tags ? Object.keys(tags) : [];
        const gauge = metricsService.registerGauge(name, labels);
        const labelValues = tags ? Object.values(tags) : [];
        gauge.set(value, labelValues);
      },
    } : undefined,
    
    // ===== Status helper =====
    /**
     * Set HTTP status code for response
     * 
     * @param code - HTTP status code (200, 201, 404, etc.)
     * @returns Context for chaining
     * 
     * @example
     * ```typescript
     * return context.status(201).send(newUser);
     * ```
     */
    status(code: number): HandlerContext {
      statusCode = code;
      context._statusCode = code;
      return context;
    },
    
    // ===== Internal properties =====
    // Original request/reply for advanced use cases
    _original: {
      request,
      reply,
    },
    
    // Status code set by handler
    _statusCode: statusCode,
  };
  
  return context;
}
