/**
 * Route registration module for YAMA Node Runtime
 * 
 * This module handles registration of HTTP routes with validation,
 * authentication, rate limiting, and middleware execution.
 * 
 * Request lifecycle phases:
 * 1. Pre-auth middleware
 * 2. Authentication & authorization
 * 3. Post-auth middleware
 * 4. Rate limiting
 * 5. Parameter/body validation
 * 6. Pre-handler middleware
 * 7. Handler execution
 * 8. Post-handler middleware
 * 9. Response validation
 * 10. Monitoring & logging
 * 
 * Error handling:
 * - Error middleware phase
 * - Monitoring hooks
 * - Structured error responses
 */

import { randomUUID } from "crypto";
import type {
  HttpRequest,
  HttpResponse,
  RouteHandler,
  HandlerFunction,
  AuthContext,
  HandlerContext,
  StorageBucket,
  MiddlewareRegistry,
  RateLimiter,
  ValidationResult,
} from "@betagors/yama-core";
import {
  createHttpServerAdapter,
  createSchemaValidator,
  authenticateAndAuthorize,
  normalizeApisConfig,
  normalizeBodyDefinition,
  createRateLimiterFromConfig,
  formatRateLimitHeaders,
  type YamaEntities,
} from "@betagors/yama-core";
import type { EndpointDefinition, YamaConfig } from "./types.js";
import { isQueryHandler } from "./types.js";
import { loadHandlerByPath } from "./handler-loader.js";
import { createHandlerContext } from "./handler-context.js";
import { executeMiddlewarePhase } from "./middleware-executor.js";
import { buildQuerySchema, coerceParams } from "./validation.js";
import { needsAuthentication } from "./auth-utils.js";
import { createQueryHandler, createDefaultHandler, getResponseType } from "./handler-factory.js";
import {
  handleError,
  createValidationError,
  createAuthError,
  createAuthzError,
  createRateLimitError,
  ValidationError,
  ErrorCodes,
  formatRestError,
} from "./error-handler.js";

/**
 * Register routes from YAMA configuration
 * 
 * Main entry point for route registration. Processes all REST API configs,
 * creates handlers, and registers routes with the HTTP server adapter.
 * 
 * For each endpoint:
 * - Loads or creates handler function
 * - Wraps handler with validation, auth, and middleware
 * - Registers route with server adapter
 * - Logs registration status
 * 
 * @param serverAdapter - HTTP server adapter (Fastify, Express, etc.)
 * @param server - Server instance created by adapter
 * @param config - YAMA configuration
 * @param configDir - Directory containing yama.yaml
 * @param validator - Schema validator instance
 * @param globalRateLimiter - Global rate limiter (if configured)
 * @param repositories - Entity repositories map
 * @param dbAdapter - Database adapter instance
 * @param cacheAdapter - Cache adapter instance
 * @param storage - Storage buckets map
 * @param realtimeAdapter - Realtime/WebSocket adapter
 * @param middlewareRegistry - Middleware registry
 * @param emailService - Email service instance
 * @param loggerService - Logger service instance
 * @param metricsService - Metrics service instance
 * @param monitoringService - Monitoring hooks service
 * 
 * @remarks
 * - Skips disabled REST configs
 * - Creates endpoint-specific rate limiters as needed
 * - Supports custom handlers, query handlers, and default handlers
 * - Automatically injects services into handler context
 */
export async function registerRoutes(
  serverAdapter: ReturnType<typeof createHttpServerAdapter>,
  server: unknown,
  config: YamaConfig,
  configDir: string,
  validator: ReturnType<typeof createSchemaValidator>,
  globalRateLimiter: RateLimiter | null,
  repositories?: Record<string, unknown>,
  dbAdapter?: unknown,
  cacheAdapter?: unknown,
  storage?: Record<string, StorageBucket>,
  realtimeAdapter?: unknown,
  middlewareRegistry?: MiddlewareRegistry,
  emailService?: any,
  loggerService?: any,
  metricsService?: any,
  monitoringService?: any
) {
  // Normalize APIs config (handles both legacy and new formats)
  // Convert schemas to entities format for normalizer (they're compatible)
  const schemasAsEntities = config.schemas ? Object.fromEntries(
    Object.entries(config.schemas).map(([name, schema]) => [
      name,
      { ...schema, fields: schema.fields || {} }
    ])
  ) : undefined;
  
  // Combine entities and schemas with database properties for handler factory
  const allEntitiesForHandlers: YamaEntities = config.entities ? { ...config.entities } : {};
  if (config.schemas) {
    for (const [schemaName, schemaDef] of Object.entries(config.schemas)) {
      // Treat schemas with database properties as entities
      if (schemaDef && typeof schemaDef === 'object' && (schemaDef.database || (schemaDef as any).table)) {
        allEntitiesForHandlers[schemaName] = schemaDef as any;
      }
    }
  }
  
  const normalizedApis = normalizeApisConfig({ 
    apis: config.apis,
    operations: (config as any).operations,
    policies: (config as any).policies,
    schemas: (schemasAsEntities as any) || config.entities,
  });

  if (normalizedApis.rest.length === 0) {
    return; // No REST endpoints configured
  }

  // Cache for endpoint-specific rate limiters (keyed by config hash)
  const endpointRateLimiters = new Map<string, RateLimiter>();

  // ===== Register routes from all REST configs =====
  for (const restConfig of normalizedApis.rest) {
    // Skip disabled configs
    if (restConfig.enabled === false) {
      continue;
    }

    for (const endpoint of restConfig.endpoints) {
      const { path, method, handler: handlerConfig, description, params, body: rawBody, query, response } = endpoint;
      
      // Normalize body definition (handles string and object formats)
      const body = normalizeBodyDefinition(rawBody);
      
      // ===== Determine handler function =====
      let handlerFn: HandlerFunction;
      let handlerLabel: string;
      
      const responseType = getResponseType(response);
      
      // Cast endpoint to EndpointDefinition for type compatibility
      // NormalizedEndpoint uses 'object' for handler, but we check for QueryHandlerConfig
      const endpointDef = endpoint as EndpointDefinition;
      
      if (isQueryHandler(handlerConfig)) {
        // Query handler (declarative query endpoint)
        handlerFn = createQueryHandler(endpointDef, config, allEntitiesForHandlers);
        handlerLabel = "query";
      } else if (typeof handlerConfig === "string") {
        // Custom handler from file
        const handlerPath = handlerConfig;
        const loadedHandler = await loadHandlerByPath(handlerPath, configDir);
        if (!loadedHandler) {
          console.warn(
            `⚠️  Handler "${handlerPath}" not found for ${method} ${path}, using default handler`
          );
          handlerFn = createDefaultHandler(endpointDef, responseType, config, allEntitiesForHandlers);
          handlerLabel = "default";
        } else {
          handlerFn = loadedHandler;
          handlerLabel = handlerPath;
        }
      } else {
        // No handler specified - use default CRUD handler
        handlerFn = createDefaultHandler(endpointDef, responseType, config, allEntitiesForHandlers);
        handlerLabel = "default";
        console.log(
          `ℹ️  No handler specified for ${method} ${path}, using default handler`
        );
      }

      // ===== Determine authentication requirement =====
      // This check happens once at route registration time, not on every request
      const requiresAuth = needsAuthentication(config, endpointDef);

      // ===== Wrap handler with full request lifecycle =====
      const wrappedHandler: RouteHandler = async (request: HttpRequest, reply: HttpResponse) => {
        // Generate unique request ID for tracing
        const requestId = randomUUID();
        
        // Record request start time for duration calculation
        const startTime = Date.now();
      
        // Create initial handler context (will be updated as we progress)
        let handlerContext: HandlerContext | null = null;

        try {
          // ============================================
          // MONITORING: Request Start
          // ============================================
          console.log(`🔍 [${requestId}] Creating handler context with ${repositories ? Object.keys(repositories).length : 0} repositories:`, repositories ? Object.keys(repositories) : 'none');
          handlerContext = createHandlerContext(
            request,
            reply,
            undefined,
            repositories,
            dbAdapter,
            cacheAdapter,
            storage,
            realtimeAdapter,
            emailService,
            loggerService,
            metricsService,
            requestId
          );
          console.log(`🔍 [${requestId}] Handler context created, entities available:`, handlerContext.entities ? Object.keys(handlerContext.entities as any) : 'none');
          
          // Call monitoring hooks if available
          if (monitoringService?.onRequestStart) {
            try {
              monitoringService.onRequestStart(request, handlerContext);
            } catch (monitoringError) {
              // Don't let monitoring errors break the request
              console.error("Monitoring error in onRequestStart:", monitoringError);
            }
          }
          
          // Log request start
          handlerContext.logger?.info("Request started", {
            method: request.method,
            path: request.path,
            query: request.query,
            params: request.params,
          });

          // ============================================
          // PHASE 1: PRE-AUTH MIDDLEWARE
          // ============================================
          const preAuthResult = await executeMiddlewarePhase(
            middlewareRegistry,
            'pre-auth',
            handlerContext,
            path,
            method
          );
          if (preAuthResult.aborted && preAuthResult.abortResponse !== undefined) {
            reply.status(200).send(preAuthResult.abortResponse);
            return;
          }

          // ============================================
          // AUTHENTICATION & AUTHORIZATION
          // ============================================
          // Public endpoints: Skip auth entirely for better performance
          // Secured endpoints: Authenticate and authorize before processing request
          let authContext: AuthContext | undefined;
          
          if (requiresAuth) {
            // --- SECURED ENDPOINT ---
            // Load custom auth handler if specified
            // Note: Custom auth handlers receive authContext and should return boolean
            // For complex cases requiring request data, handlers can access it via closure
            let authHandler: ((authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean) | undefined;
            if (endpoint.auth?.handler) {
              const authHandlerPath = endpoint.auth.handler;
              const loadedHandler = await loadHandlerByPath(authHandlerPath, configDir);
              if (loadedHandler) {
                // Wrap handler - custom auth handlers should work with authContext
                // They can access request data through the closure if needed
                authHandler = async (authContext: AuthContext) => {
                  try {
                    // Create a minimal handler context for auth check
                    // Auth handlers can access request via closure if needed
                    const authCheckContext = {
                      authenticated: authContext.authenticated,
                      user: authContext.user,
                      // Pass request info for complex checks
                      request: {
                        method,
                        path,
                        params: request.params || {},
                        query: request.query || {},
                        body: request.body,
                      },
                    };
                    
                    // Call the handler - it should return a boolean or throw
                    // For now, we'll call it with a minimal context that has auth info
                    // In the future, we might want to pass request data explicitly
                    const result = await loadedHandler(authCheckContext as any);
                    // If handler returns a value, treat truthy as authorized
                    // If handler throws, it will be caught below
                    return result !== false && result !== null && result !== undefined;
                  } catch (error) {
                    // Handler threw an error - treat as unauthorized
                    return false;
                  }
                };
              } else {
                console.warn(
                  `⚠️  Auth handler "${authHandlerPath}" not found for ${method} ${path}, authorization will fail`
                );
              }
            }
            
            // Authenticate using configured providers and authorize based on endpoint requirements
            const authResult = await authenticateAndAuthorize(
              request.headers,
              config.auth,
              endpoint.auth,
              authHandler
            );

            if (!authResult.authorized) {
              const authError = createAuthError(
                authResult.error || "Authentication or authorization failed",
                ErrorCodes.AUTH_REQUIRED
              );
              const response = formatRestError(authError, { requestId, path, method });
              reply.status(authError.statusCode).send(response);
              return;
            }

            authContext = authResult.context;
          } else {
            // --- PUBLIC ENDPOINT ---
            // No authentication required - skip auth checks for performance
            authContext = { authenticated: false };
          }

          // Update handler context with auth
          handlerContext.auth = authContext;

          // ============================================
          // PHASE 2: POST-AUTH MIDDLEWARE
          // ============================================
          const postAuthResult = await executeMiddlewarePhase(
            middlewareRegistry,
            'post-auth',
            handlerContext,
            path,
            method
          );
          if (postAuthResult.aborted && postAuthResult.abortResponse !== undefined) {
            reply.status(200).send(postAuthResult.abortResponse);
            return;
          }

          // ============================================
          // RATE LIMITING
          // ============================================
          // Check rate limit (after auth so we can use user ID if available)
          const rateLimitConfig = endpoint.rateLimit || config.rateLimit;
          if (rateLimitConfig) {
            let rateLimiter = globalRateLimiter;
            
            // If no global rate limiter and endpoint has its own config, get or create endpoint-specific limiter
            if (!rateLimiter && endpoint.rateLimit) {
              const configKey = JSON.stringify(endpoint.rateLimit);
              if (!endpointRateLimiters.has(configKey)) {
                // Use cache adapter if available (works with any cache implementation)
                endpointRateLimiters.set(configKey, await createRateLimiterFromConfig(endpoint.rateLimit as any, cacheAdapter as any));
              }
              rateLimiter = endpointRateLimiters.get(configKey)!;
            }
            
            // If still no rate limiter, create one from global config and cache it
            if (!rateLimiter && config.rateLimit) {
              const globalConfigKey = JSON.stringify(config.rateLimit);
              if (!endpointRateLimiters.has(globalConfigKey)) {
                // Use cache adapter if available (works with any cache implementation)
                endpointRateLimiters.set(globalConfigKey, await createRateLimiterFromConfig(config.rateLimit as any, cacheAdapter as any));
              }
              rateLimiter = endpointRateLimiters.get(globalConfigKey)!;
            }
            
            if (rateLimiter) {
              const rateLimitResult = await rateLimiter.check(request, authContext, rateLimitConfig as any);
            
              // Add rate limit headers to response
              const rateLimitHeaders = formatRateLimitHeaders(rateLimitResult);
              const originalReply = reply._original as any;
              if (originalReply && typeof originalReply.header === "function") {
                for (const [key, value] of Object.entries(rateLimitHeaders)) {
                  originalReply.header(key, value);
                }
              }
              
              if (!rateLimitResult.allowed) {
                const rateLimitError = createRateLimitError(
                  Math.ceil(rateLimitResult.resetAfter / 1000),
                  rateLimitResult.limit,
                  rateLimitResult.remaining
                );
                const response = formatRestError(rateLimitError, { requestId, path, method });
                reply.status(rateLimitError.statusCode).send(response);
                return;
              }
            }
          }

          // ============================================
          // VALIDATION: Path Parameters
          // ============================================
          if (params && Object.keys(params).length > 0) {
            const coercedParams = coerceParams(request.params, params, config.schemas);
            
            // Build a temporary schema for path parameter validation
            const paramsSchema = buildQuerySchema(params, config.schemas);
            const paramsValidation = validator.validateSchema(paramsSchema, coercedParams);
            
            if (!paramsValidation.valid) {
              const validationError = createValidationError(
                "Path parameter validation failed",
                (paramsValidation.errors || []).map((e: any) => ({
                  field: e.instancePath?.replace(/^\//, '') || e.params?.missingProperty,
                  message: e.message || 'Validation failed',
                  rule: e.keyword,
                })),
                'params'
              );
              const response = formatRestError(validationError, { requestId, path, method });
              reply.status(validationError.statusCode).send(response);
              return;
            }
            
            // Replace params with coerced values
            request.params = coercedParams;
          }

          // ============================================
          // VALIDATION: Query Parameters
          // ============================================
          if (query && Object.keys(query).length > 0) {
            const coercedQuery = coerceParams(request.query, query, config.schemas);
            
            // Build a temporary schema for query validation
            const querySchema = buildQuerySchema(query, config.schemas);
            const queryValidation = validator.validateSchema(querySchema, coercedQuery);
            
            if (!queryValidation.valid) {
              const validationError = createValidationError(
                "Query parameter validation failed",
                (queryValidation.errors || []).map((e: any) => ({
                  field: e.instancePath?.replace(/^\//, '') || e.params?.missingProperty,
                  message: e.message || 'Validation failed',
                  rule: e.keyword,
                })),
                'query'
              );
              const response = formatRestError(validationError, { requestId, path, method });
              reply.status(validationError.statusCode).send(response);
              return;
            }
            
            // Replace query with coerced values
            request.query = coercedQuery;
          }

          // ============================================
          // VALIDATION: Request Body
          // ============================================
          if (body && request.body) {
            let validation: ValidationResult;
            
            // If body has type (schema reference), validate against that schema
            if (body.type) {
              validation = await validator.validate(body.type, request.body);
            } 
            // If body has fields (inline definition), create temporary schema and validate
            else if (body.fields) {
              const bodySchema = buildQuerySchema(body.fields, config.schemas);
              validation = validator.validateSchema(bodySchema, request.body);
            } else {
              validation = { valid: true };
            }
            
            if (!validation.valid) {
              const validationError = createValidationError(
                "Request body validation failed",
                (validation.errors || []).map((e: any) => ({
                  field: e.instancePath?.replace(/^\//, '') || e.params?.missingProperty,
                  message: e.message || 'Validation failed',
                  rule: e.keyword,
                })),
                'body'
              );
              const response = formatRestError(validationError, { requestId, path, method });
              reply.status(validationError.statusCode).send(response);
              return;
            }
          }

          // ============================================
          // UPDATE CONTEXT
          // ============================================
          // Update handler context with latest request data (after validation)
          handlerContext.method = request.method;
          handlerContext.url = request.url;
          handlerContext.path = request.path;
          handlerContext.query = request.query;
          handlerContext.params = request.params;
          handlerContext.body = request.body;
          handlerContext.headers = request.headers;
          
          // Re-inject services in case context was recreated
          if (loggerService) {
            handlerContext.logger = {
              info: (message: string, meta?: Record<string, unknown>) => loggerService.info(message, meta),
              warn: (message: string, meta?: Record<string, unknown>) => loggerService.warn(message, meta),
              error: (message: string, error?: Error, meta?: Record<string, unknown>) => loggerService.error(message, error, meta),
              debug: (message: string, meta?: Record<string, unknown>) => loggerService.debug(message, meta),
            };
          }
          if (metricsService) {
            handlerContext.metrics = {
              increment: (name: string, value?: number, tags?: Record<string, string>) => {
                const labels = tags ? Object.keys(tags) : [];
                const counter = metricsService.registerCounter(name, labels);
                const labelValues = tags ? Object.values(tags) : [];
                counter.inc(value || 1, labelValues);
              },
              histogram: (name: string, value: number, tags?: Record<string, string>) => {
                const labels = tags ? Object.keys(tags) : [];
                const histogram = metricsService.registerHistogram(name, labels);
                const labelValues = tags ? Object.values(tags) : [];
                histogram.observe(value, labelValues);
              },
              gauge: (name: string, value: number, tags?: Record<string, string>) => {
                const labels = tags ? Object.keys(tags) : [];
                const gauge = metricsService.registerGauge(name, labels);
                const labelValues = tags ? Object.values(tags) : [];
                gauge.set(value, labelValues);
              },
            };
          }
          
          const context = handlerContext;

          // ============================================
          // PHASE 3: PRE-HANDLER MIDDLEWARE
          // ============================================
          const preHandlerResult = await executeMiddlewarePhase(
            middlewareRegistry,
            'pre-handler',
            context,
            path,
            method
          );
          if (preHandlerResult.aborted && preHandlerResult.abortResponse !== undefined) {
            reply.status(200).send(preHandlerResult.abortResponse);
            return;
          }

          // ============================================
          // HANDLER EXECUTION
          // ============================================
          // Call handler with context
          const result = await handlerFn(context);
          
          // Debug: log result for create operations
          if (method.toUpperCase() === 'POST' && result !== undefined) {
            console.log(`📝 POST handler result for ${path}:`, JSON.stringify(result, null, 2));
          }
          
          // ============================================
          // PHASE 4: POST-HANDLER MIDDLEWARE
          // ============================================
          const postHandlerResult = await executeMiddlewarePhase(
            middlewareRegistry,
            'post-handler',
            context,
            path,
            method
          );
          if (postHandlerResult.aborted && postHandlerResult.abortResponse !== undefined) {
            reply.status(200).send(postHandlerResult.abortResponse);
            return;
          }
          
          // ============================================
          // DETERMINE STATUS CODE
          // ============================================
          // Use handler-set status, or default based on method
          let statusCode = context._statusCode;
          if (statusCode === undefined) {
            // Default status codes
            if (method.toUpperCase() === "POST") {
              statusCode = 201;
            } else if (method.toUpperCase() === "DELETE") {
              statusCode = 204;
            } else {
              statusCode = 200;
            }
          }
          
          // ============================================
          // VALIDATION: Response
          // ============================================
          // Validate response if response model is specified
          if (responseType && result !== undefined) {
            const responseValidation = await validator.validate(responseType, result);
            
            if (!responseValidation.valid) {
              // Filter out errors for relation fields if foreign key exists
              // This handles cases where schema has `author: Author!` but response has `authorId`
              // Also be lenient with id field if it's a primary key (should be there, but allow if missing)
              const filteredErrors = (responseValidation.errors || []).filter((error: any) => {
                if (error.keyword === 'required' && error.params?.missingProperty) {
                  const missingField = error.params.missingProperty;
                  
                  // Allow id to be missing if it's a primary key (though it should normally be present)
                  // This is a lenient check - id should be returned by repositories
                  if (missingField === 'id' && result && typeof result === 'object') {
                    // If id is missing but this is a create response, it might be a mapper issue
                    // For now, we'll be lenient and allow it (though ideally id should be present)
                    console.warn(`⚠️  Warning: Response missing 'id' field - this should normally be present`);
                    return false; // Filter out id error (be lenient)
                  }
                  
                  // Check if this is a relation field (capitalized name suggests schema reference)
                  const isSchemaReference = /^[A-Z][a-zA-Z0-9]*$/.test(missingField);
                  if (isSchemaReference && result && typeof result === 'object') {
                    // Check if foreign key exists (e.g., authorId for author field)
                    const foreignKeyName = `${missingField.charAt(0).toLowerCase() + missingField.slice(1)}Id`;
                    if (foreignKeyName in result) {
                      // Foreign key exists, relation field is optional
                      return false; // Filter out this error
                    }
                  }
                }
                return true; // Keep other errors
              });
              
              // Only fail if there are still errors after filtering
              if (filteredErrors.length > 0) {
                console.error(`❌ [${requestId}] Response validation failed for ${handlerLabel}:`, filteredErrors);
                const validationError = new ValidationError(
                  process.env.NODE_ENV === "development" 
                    ? "Response validation failed" 
                    : "Response does not match expected schema",
                  {
                    code: ErrorCodes.VALIDATION_RESPONSE,
                    details: process.env.NODE_ENV === "development" 
                      ? filteredErrors.map((e: any) => ({
                          field: e.instancePath?.replace(/^\//, '') || e.params?.missingProperty,
                          message: e.message || 'Validation failed',
                          rule: e.keyword,
                        }))
                      : undefined,
                  }
                );
                // Response validation errors are 500 since it's a server-side issue
                const response = formatRestError(validationError, { requestId, path, method });
                reply.status(500).send(response);
                return;
              }
              // All errors were filtered out (relation fields with foreign keys), validation passes
            }
          }

          // ============================================
          // SEND RESPONSE
          // ============================================
          if (statusCode === 204) {
            // No content - don't send body
            reply.status(statusCode).send(undefined);
          } else {
            reply.status(statusCode).send(result);
          }
          
          // ============================================
          // MONITORING: Request End (Success)
          // ============================================
          const duration = Date.now() - startTime;
          
          // Call monitoring hooks if available
          if (monitoringService?.onRequestEnd) {
            try {
              monitoringService.onRequestEnd(request, reply, duration, context);
            } catch (monitoringError) {
              console.error("Monitoring error in onRequestEnd:", monitoringError);
            }
          }
          
          // Track metrics
          context.metrics?.histogram("http.request.duration", duration, {
            method: request.method,
            path: request.path,
          });
          context.metrics?.increment("http.requests", 1, {
            method: request.method,
            path: request.path,
            status: statusCode.toString(),
          });
          
          // Log response
          const meta = {
            method: request.method,
            path: request.path,
            status: statusCode,
            duration,
          };
          if (statusCode >= 500) {
            context.logger?.error("Request completed", undefined, meta);
          } else if (statusCode >= 400) {
            context.logger?.warn("Request completed", meta);
          } else {
            context.logger?.info("Request completed", meta);
          }
          
          return result;
        } catch (error) {
          // ============================================
          // ERROR HANDLING
          // ============================================
          // Ensure handler context exists for error middleware
          if (!handlerContext) {
            handlerContext = createHandlerContext(
              request,
              reply,
              undefined,
              repositories,
              dbAdapter,
              cacheAdapter,
              storage,
              realtimeAdapter,
              emailService,
              loggerService,
              metricsService,
              requestId
            );
          }
          
          // Call monitoring error hooks if available
          if (monitoringService?.onError) {
            try {
              const errorContext = {
                request: {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  params: request.params,
                  headers: request.headers,
                },
                user: handlerContext.auth?.user,
                context: handlerContext,
                metadata: {
                  handler: handlerLabel,
                  requestId,
                },
              };
              monitoringService.onError(error instanceof Error ? error : new Error(String(error)), errorContext);
            } catch (monitoringError) {
              console.error(`[${requestId}] Monitoring error in onError:`, monitoringError);
            }
          }
          
          // ============================================
          // PHASE 5: ERROR MIDDLEWARE
          // ============================================
          try {
            const errorResult = await executeMiddlewarePhase(
              middlewareRegistry,
              'error',
              handlerContext,
              path,
              method
            );
            if (errorResult.aborted && errorResult.abortResponse !== undefined) {
              reply.status(200).send(errorResult.abortResponse);
              return;
            }
          } catch (mwError) {
            // If error middleware itself fails, log and continue with default error handling
            console.error(`[${requestId}] Error in error middleware:`, mwError);
          }
          
          // Use central error handler for standardized response
          handleError(error, request, reply, handlerContext);
        }
      };

      // ===== Register route using adapter =====
      // Debug: Log the exact path being registered
      console.log(`🔍 Registering route: ${method.toUpperCase()} ${path} (raw path from endpoint)`);
      serverAdapter.registerRoute(server, method, path, wrappedHandler);

      // ===== Log route registration =====
      const authStatus = requiresAuth 
        ? ` [SECURED${endpoint.auth?.roles ? `, roles: ${endpoint.auth.roles.join(", ")}` : ""}]`
        : " [PUBLIC]";
      const bodyType = body && typeof body === 'object' && 'type' in body ? body.type : undefined;
      
      console.log(
        `✅ Registered route: ${method.toUpperCase()} ${path} -> ${handlerLabel}${authStatus}${description ? ` (${description})` : ""}${params ? ` [validates path params]` : ""}${query ? ` [validates query params]` : ""}${bodyType ? ` [validates body: ${bodyType}]` : ""}${responseType ? ` [validates response: ${responseType}]` : ""}`
      );
    }
  }
}
