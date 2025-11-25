import {
  helloYamaCore,
  createSchemaValidator,
  type YamaSchemas,
  type ValidationResult,
  type SchemaField,
  fieldToJsonSchema,
  type AuthConfig,
  type EndpointAuth,
  authenticateAndAuthorize,
  type YamaEntities,
  type DatabaseConfig,
  type ServerConfig,
  entitiesToSchemas,
  mergeSchemas,
  loadEnvFile,
  resolveEnvVars,
  createDatabaseAdapter,
  createHttpServerAdapter,
  registerHttpServerAdapter,
  type HttpRequest,
  type HttpResponse,
  type RouteHandler,
  type HandlerContext,
  type HandlerFunction,
  loadPlugin,
  type YamaPlugin,
  generateAllCrudEndpoints,
  generateCrudInputSchemas,
  generateArraySchema,
  registerGlobalDatabaseAdapter,
  getAllOAuthProviders,
  type OAuthProviderMetadata,
  type RateLimitConfig,
  createRateLimiterFromConfig,
  type RateLimiter,
  formatRateLimitHeaders,
} from "@betagors/yama-core";
import { generateOpenAPI } from "@betagors/yama-docs-generator";
import { createFastifyAdapter } from "@betagors/yama-fastify";
import yaml from "js-yaml";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, extname, resolve, relative } from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";
import { tmpdir } from "os";

interface YamaConfig {
  name?: string;
  version?: string;
  schemas?: YamaSchemas;
  entities?: YamaEntities;
  server?: ServerConfig;
  auth?: AuthConfig;
  rateLimit?: RateLimitConfig;
  plugins?: Record<string, Record<string, unknown>> | string[]; // Plugin configs or list of plugin names
  endpoints?: Array<{
    path: string;
    method: string;
    handler?: string; // Optional - if not provided, uses default handler
    description?: string;
    params?: Record<string, SchemaField>;
    body?: {
      type: string;
    };
    query?: Record<string, SchemaField>;
    response?: {
      type: string;
    };
    auth?: EndpointAuth;
    rateLimit?: RateLimitConfig;
  }>;
}

// HandlerFunction is now imported from core, which uses HandlerContext

/**
 * Resolve @betagors/yama-* and @gen/* imports using package.json exports
 */
function resolveYamaImports(handlerContent: string, projectRoot: string, fromPath: string): string {
  try {
    const packageJsonPath = join(projectRoot, "package.json");
    if (!existsSync(packageJsonPath)) {
      return handlerContent;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const exports = packageJson.exports || {};

    // Replace @betagors/yama-* and @gen/* imports with resolved paths
    let resolvedContent = handlerContent;
    for (const [exportPath, exportValue] of Object.entries(exports)) {
      if (exportPath.startsWith("@betagors/yama-") || exportPath.startsWith("@gen/")) {
        let resolvedPath: string;
        if (typeof exportValue === "string") {
          resolvedPath = exportValue;
        } else if (exportValue && typeof exportValue === "object" && "default" in exportValue) {
          resolvedPath = String((exportValue as { default?: string }).default || exportPath);
        } else {
          continue; // Skip if we can't resolve
        }
        
        // Convert to relative path from the file that will import it (fromPath)
        const absolutePath = resolve(projectRoot, resolvedPath);
        const fromDir = dirname(fromPath);
        let relativePath = relative(fromDir, absolutePath).replace(/\\/g, "/");
        
        // Ensure path starts with ./
        if (!relativePath.startsWith(".")) {
          relativePath = `./${relativePath}`;
        }
        
        // Ensure .ts extension is preserved for ES modules
        if (resolvedPath.endsWith(".ts") && !relativePath.endsWith(".ts")) {
          relativePath = `${relativePath}.ts`;
        }
        
        // Replace import statements (handle both import and import type)
        const importRegex = new RegExp(
          `(import\\s+(?:type\\s+)?[^"']*\\s+from\\s+["'])${exportPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'])`,
          "g"
        );
        resolvedContent = resolvedContent.replace(importRegex, `$1${relativePath}$2`);
      }
    }

    return resolvedContent;
  } catch (error) {
    // If resolution fails, return original content
    return handlerContent;
  }
}

/**
 * Load all handler functions from the handlers directory
 */
async function loadHandlers(handlersDir: string, projectRoot?: string): Promise<Record<string, HandlerFunction>> {
  const handlers: Record<string, HandlerFunction> = {};

  if (!existsSync(handlersDir)) {
    console.warn(`⚠️  Handlers directory not found: ${handlersDir}`);
    return handlers;
  }

  // Determine project root (directory containing package.json)
  const configRoot = projectRoot || dirname(handlersDir);
  let actualProjectRoot = configRoot;
  let packageJsonPath = join(configRoot, "package.json");
  
  // Walk up to find package.json
  while (!existsSync(packageJsonPath) && actualProjectRoot !== dirname(actualProjectRoot)) {
    actualProjectRoot = dirname(actualProjectRoot);
    packageJsonPath = join(actualProjectRoot, "package.json");
  }

  try {
    const files = readdirSync(handlersDir);
    const tsFiles = files.filter(
      (file) => extname(file) === ".ts" || extname(file) === ".ts"
    );

    for (const file of tsFiles) {
      const handlerName = file.replace(/\.(ts|js)$/, "");
      const handlerPath = join(handlersDir, file);

      try {
        // Read handler content
        let handlerContent = readFileSync(handlerPath, "utf-8");
        let importPath = handlerPath;
        
        // Resolve @betagors/yama-* and @gen/* imports if package.json exists
        if (existsSync(packageJsonPath)) {
          // Determine where the file will be located (temp file or original)
          const tempDir = join(tmpdir(), "yama-handlers");
          const tempPath = join(tempDir, `${handlerName}-${Date.now()}.ts`);
          
          // Resolve imports relative to where the file will be (temp file location)
          // This ensures relative paths are correct when the handler is loaded
          const transformedContent = resolveYamaImports(handlerContent, actualProjectRoot, tempPath);
          
          // If content was transformed, write to temp file
          if (transformedContent !== handlerContent) {
            mkdirSync(tempDir, { recursive: true });
            writeFileSync(tempPath, transformedContent, "utf-8");
            importPath = tempPath;
          }
        }

        // Convert to absolute path and then to file URL for ES module import
        const absolutePath = resolve(importPath);
        // Use file:// URL for ES module import
        // Note: When running with tsx, it will handle .ts files automatically
        const fileUrl = pathToFileURL(absolutePath).href;
        
        // Dynamic import for ES modules
        // For TypeScript files to work, the process must be run with tsx
        const handlerModule = await import(fileUrl);
        
        // Look for exported function with the same name as the file
        // or default export
        const handlerFn = handlerModule[handlerName] || handlerModule.default;
        
        if (typeof handlerFn === "function") {
          handlers[handlerName] = handlerFn;
          console.log(`✅ Loaded handler: ${handlerName}`);
        } else {
          console.warn(`⚠️  Handler ${handlerName} does not export a function`);
        }
      } catch (error) {
        console.error(`❌ Failed to load handler ${handlerName}:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to read handlers directory:`, error);
  }

  return handlers;
}

/**
 * Load entity repositories from generated database code
 * Maps entity names to repository instances (e.g., "Product" → productRepository)
 */
async function loadRepositories(
  configDir: string,
  entities?: YamaEntities
): Promise<Record<string, unknown>> {
  const repositories: Record<string, unknown> = {};

  // If no entities defined, return empty object
  if (!entities || Object.keys(entities).length === 0) {
    return repositories;
  }

  // Construct path to .yama/gen/db/index.ts
  const dbIndexPath = join(configDir, ".yama", "gen", "db", "index.ts");

  // Check if repository index file exists
  if (!existsSync(dbIndexPath)) {
    console.warn(`⚠️  Repository index not found: ${dbIndexPath} (repositories may not be generated yet)`);
    return repositories;
  }

  try {
    // Convert to absolute path and then to file URL for ES module import
    const absolutePath = resolve(dbIndexPath);
    const fileUrl = pathToFileURL(absolutePath).href;

    // Dynamic import for ES modules
    const repositoryModule = await import(fileUrl);

    // Map entity names to repository instances
    // Entity "Product" → repository export "productRepository"
    for (const entityName of Object.keys(entities)) {
      const repositoryName = `${entityName.charAt(0).toLowerCase() + entityName.slice(1)}Repository`;
      
      if (repositoryName in repositoryModule) {
        repositories[entityName] = repositoryModule[repositoryName];
        console.log(`✅ Loaded repository: ${entityName} → ${repositoryName}`);
      } else {
        console.warn(`⚠️  Repository ${repositoryName} not found for entity ${entityName}`);
      }
    }
  } catch (error) {
    console.warn(
      `⚠️  Failed to load repositories from ${dbIndexPath}:`,
      error instanceof Error ? error.message : String(error)
    );
    // Return empty object on error - runtime continues without repositories
  }

  return repositories;
}

/**
 * Build a JSON schema for query parameter validation
 */
function buildQuerySchema(
  queryParams: Record<string, SchemaField>,
  schemas?: YamaSchemas
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [paramName, paramField] of Object.entries(queryParams)) {
    // Convert the field directly to JSON schema
    properties[paramName] = fieldToJsonSchema(paramField, paramName, schemas);
    
    if (paramField.required) {
      required.push(paramName);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties
  };
  
  if (required.length > 0) {
    schema.required = required;
  }
  
  return schema;
}

/**
 * Coerce path/query parameters to their proper types
 * Parameters come as strings from URLs, so we need to convert them
 */
function coerceParams(
  params: Record<string, unknown>,
  paramDefs: Record<string, SchemaField>,
  schemas?: YamaSchemas
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const paramDef = paramDefs[key];
    if (!paramDef) {
      // Unknown query param, pass through as-is
      coerced[key] = value;
      continue;
    }

    // Handle type coercion
    if (value === undefined || value === null || value === "") {
      if (paramDef.default !== undefined) {
        coerced[key] = paramDef.default;
      } else if (!paramDef.required) {
        // Optional param with no value, skip it
        continue;
      }
      coerced[key] = value;
      continue;
    }

    const type = paramDef.$ref ? 
      (schemas?.[paramDef.$ref]?.fields ? "object" : undefined) : 
      paramDef.type;

    switch (type) {
      case "boolean":
        // Handle string "true"/"false" or actual booleans
        if (typeof value === "string") {
          coerced[key] = value.toLowerCase() === "true" || value === "1";
        } else {
          coerced[key] = Boolean(value);
        }
        break;
      case "integer":
      case "number":
        const num = typeof value === "string" ? parseFloat(value) : Number(value);
        coerced[key] = isNaN(num) ? value : num;
        break;
      default:
        coerced[key] = value;
    }
  }

  return coerced;
}

/**
 * Default handler for endpoints without custom handlers
 */
/**
 * Create a handler context from request and reply
 */
function createHandlerContext(
  request: HttpRequest,
  reply: HttpResponse,
  authContext?: { authenticated: boolean; user?: unknown; provider?: string; token?: string },
  repositories?: Record<string, unknown>,
  dbAdapter?: unknown,
  cacheAdapter?: unknown
): HandlerContext {
  let statusCode: number | undefined;
  
  const context: HandlerContext = {
    // Request data
    method: request.method,
    url: request.url,
    path: request.path,
    query: request.query,
    params: request.params,
    body: request.body,
    headers: request.headers,
    
    // Auth context
    auth: authContext,
    
    // Database access
    db: dbAdapter,
    entities: repositories,
    
    // Cache access
    cache: cacheAdapter as any,
    
    // Status helper
    status(code: number): HandlerContext {
      statusCode = code;
      context._statusCode = code;
      return context;
    },
    
    // Original request/reply
    _original: {
      request,
      reply,
    },
    
    _statusCode: statusCode,
  };
  
  return context;
}

function createDefaultHandler(
  endpoint: NonNullable<YamaConfig["endpoints"]>[number],
  responseType?: string
): HandlerFunction {
  return async (context: HandlerContext) => {
    // If response type is specified, return an empty object (will be validated)
    // Otherwise, return a simple success message
    if (responseType) {
      return {};
    }
    
    return {
      message: `Endpoint ${endpoint.method} ${endpoint.path} is configured but no handler is implemented`,
      path: endpoint.path,
      method: endpoint.method,
    };
  };
}

/**
 * Determine if an endpoint requires authentication
 * 
 * Returns true if the endpoint needs authentication, false if it's public.
 * 
 * Logic (in order of precedence):
 * 1. If endpoint.auth.required === false, it's explicitly public → return false
 * 2. If endpoint.auth.required === true or endpoint.auth.roles exists, it requires auth → return true
 * 3. If endpoint.auth exists (but no explicit required/roles), and config.auth exists → requires auth (default)
 * 4. If no endpoint.auth but config.auth exists → requires auth (default behavior when global auth is configured)
 * 5. If neither endpoint.auth nor config.auth exists → public endpoint
 */
function needsAuthentication(
  config: YamaConfig,
  endpoint: NonNullable<YamaConfig["endpoints"]>[number]
): boolean {
  const endpointAuth = endpoint.auth;
  const configAuth = config.auth;

  // Case 1: Explicitly public endpoint (highest priority)
  if (endpointAuth?.required === false) {
    return false;
  }

  // Case 2: Explicitly requires auth (required === true or roles specified)
  if (endpointAuth?.required === true || (endpointAuth?.roles && endpointAuth.roles.length > 0)) {
    return true;
  }

  // Case 3: Endpoint has auth config object but no explicit required flag
  // If global auth exists, default to requiring auth
  if (endpointAuth && configAuth) {
    return true;
  }

  // Case 4: No endpoint auth config but global auth exists
  // Default behavior: require auth when global auth is configured
  if (!endpointAuth && configAuth) {
    return true;
  }

  // Case 5: No auth configuration at all - public endpoint
  return false;
}

/**
 * Register routes from YAML config with validation
 */
function registerRoutes(
  serverAdapter: ReturnType<typeof createHttpServerAdapter>,
  server: unknown,
  config: YamaConfig,
  handlers: Record<string, HandlerFunction>,
  validator: ReturnType<typeof createSchemaValidator>,
  globalRateLimiter: RateLimiter | null,
  repositories?: Record<string, unknown>,
  dbAdapter?: unknown
) {
  if (!config.endpoints) {
    return;
  }

  // Cache for endpoint-specific rate limiters (keyed by config hash)
  const endpointRateLimiters = new Map<string, RateLimiter>();

  for (const endpoint of config.endpoints) {
    const { path, method, handler: handlerName, description, params, body, query, response } = endpoint;
    
    // Use custom handler if provided, otherwise use default handler
    let handlerFn: HandlerFunction;
    
    if (handlerName) {
      handlerFn = handlers[handlerName];
      if (!handlerFn) {
        console.warn(
          `⚠️  Handler "${handlerName}" not found for ${method} ${path}, using default handler`
        );
        handlerFn = createDefaultHandler(endpoint, response?.type);
      }
    } else {
      // No handler specified - use default handler
      handlerFn = createDefaultHandler(endpoint, response?.type);
      console.log(
        `ℹ️  No handler specified for ${method} ${path}, using default handler`
      );
    }

    // Determine if this endpoint requires authentication
    // This check happens once at route registration time, not on every request
    const requiresAuth = needsAuthentication(config, endpoint);

    // Wrap handler with validation and auth
    // The wrapped handler receives request/reply from the adapter, then creates context for user handlers
    const wrappedHandler: RouteHandler = async (request: HttpRequest, reply: HttpResponse) => {
      try {
        // ============================================
        // AUTHENTICATION & AUTHORIZATION
        // ============================================
        // Public endpoints: Skip auth entirely for better performance
        // Secured endpoints: Authenticate and authorize before processing request
        let authContext: { authenticated: boolean; user?: unknown; provider?: string; token?: string } | undefined;
        
        if (requiresAuth) {
          // --- SECURED ENDPOINT ---
          // Authenticate using configured providers and authorize based on endpoint requirements
          const authResult = await authenticateAndAuthorize(
            request.headers,
            config.auth,
            endpoint.auth
          );

          if (!authResult.authorized) {
            reply.status(401).send({
              error: "Unauthorized",
              message: authResult.error || "Authentication or authorization failed",
            });
            return;
          }

          authContext = authResult.context;
        } else {
          // --- PUBLIC ENDPOINT ---
          // No authentication required - skip auth checks for performance
          authContext = { authenticated: false };
        }

        // Check rate limit (after auth so we can use user ID if available)
        const rateLimitConfig = endpoint.rateLimit || config.rateLimit;
        if (rateLimitConfig) {
          let rateLimiter = globalRateLimiter;
          
          // If no global rate limiter and endpoint has its own config, get or create endpoint-specific limiter
          if (!rateLimiter && endpoint.rateLimit) {
            const configKey = JSON.stringify(endpoint.rateLimit);
            if (!endpointRateLimiters.has(configKey)) {
              // Use cache adapter if available (works with any cache implementation)
              endpointRateLimiters.set(configKey, await createRateLimiterFromConfig(endpoint.rateLimit, cacheAdapter as any));
            }
            rateLimiter = endpointRateLimiters.get(configKey)!;
          }
          
          // If still no rate limiter, create one from global config and cache it (shouldn't happen if globalRateLimiter initialized correctly)
          if (!rateLimiter && config.rateLimit) {
            const globalConfigKey = JSON.stringify(config.rateLimit);
            if (!endpointRateLimiters.has(globalConfigKey)) {
              // Use cache adapter if available (works with any cache implementation)
              endpointRateLimiters.set(globalConfigKey, await createRateLimiterFromConfig(config.rateLimit, cacheAdapter as any));
            }
            rateLimiter = endpointRateLimiters.get(globalConfigKey)!;
          }
          
          if (rateLimiter) {
            const rateLimitResult = await rateLimiter.check(request, authContext, rateLimitConfig);
          
            // Add rate limit headers to response
            const rateLimitHeaders = formatRateLimitHeaders(rateLimitResult);
            const originalReply = reply._original as any;
            if (originalReply && typeof originalReply.header === "function") {
              for (const [key, value] of Object.entries(rateLimitHeaders)) {
                originalReply.header(key, value);
              }
            }
            
            if (!rateLimitResult.allowed) {
              reply.status(429).send({
                error: "Too Many Requests",
                message: `Rate limit exceeded. Try again after ${Math.ceil(rateLimitResult.resetAfter / 1000)} seconds.`,
                retryAfter: Math.ceil(rateLimitResult.resetAfter / 1000),
              });
              return;
            }
          }
        }

        // Validate and coerce path parameters if specified
        if (params && Object.keys(params).length > 0) {
          const coercedParams = coerceParams(request.params, params, config.schemas);
          
          // Build a temporary schema for path parameter validation
          const paramsSchema = buildQuerySchema(params, config.schemas);
          const paramsValidation = validator.validateSchema(paramsSchema, coercedParams);
          
          if (!paramsValidation.valid) {
            reply.status(400).send({
              error: "Path parameter validation failed",
              message: validator.formatErrors(paramsValidation.errors || []),
              errors: paramsValidation.errors
            });
            return;
          }
          
          // Replace params with coerced values
          request.params = coercedParams;
        }

        // Validate and coerce query parameters if specified
        if (query && Object.keys(query).length > 0) {
          const coercedQuery = coerceParams(request.query, query, config.schemas);
          
          // Build a temporary schema for query validation
          const querySchema = buildQuerySchema(query, config.schemas);
          const queryValidation = validator.validateSchema(querySchema, coercedQuery);
          
          if (!queryValidation.valid) {
            reply.status(400).send({
              error: "Query parameter validation failed",
              message: validator.formatErrors(queryValidation.errors || []),
              errors: queryValidation.errors
            });
            return;
          }
          
          // Replace query with coerced values
          request.query = coercedQuery;
        }

        // Validate request body if model is specified
        if (body?.type && request.body) {
          const validation = validator.validate(body.type, request.body);
          
          if (!validation.valid) {
            reply.status(400).send({
              error: "Validation failed",
              message: validation.errorMessage || validator.formatErrors(validation.errors || []),
              errors: validation.errors
            });
            return;
          }
        }

        // Create handler context
        const context = createHandlerContext(request, reply, authContext, repositories, dbAdapter, cacheAdapter);

        // Call handler with context
        const result = await handlerFn(context);
        
        // Determine status code: use handler-set status, or default based on method
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
        
        // Validate response if response model is specified
        if (response?.type && result !== undefined) {
          const responseValidation = validator.validate(response.type, result);
          
          if (!responseValidation.valid) {
            const handlerLabel = handlerName || "default";
            console.error(`❌ Response validation failed for ${handlerLabel}:`, responseValidation.errors);
            // In development, return validation errors; in production, log and return generic error
            if (process.env.NODE_ENV === "development") {
              reply.status(500).send({
                error: "Response validation failed",
                message: validator.formatErrors(responseValidation.errors || []),
                errors: responseValidation.errors
              });
              return;
            } else {
              reply.status(500).send({
                error: "Internal server error",
                message: "Response does not match expected schema"
              });
              return;
            }
          }
        }

        // Send response with appropriate status code
        if (statusCode === 204) {
          // No content - don't send body
          reply.status(statusCode).send(undefined);
        } else {
          reply.status(statusCode).send(result);
        }
        
        return result;
      } catch (error) {
        const handlerLabel = handlerName || "default";
        console.error(`Error in handler ${handlerLabel}:`, error);
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    };

    // Register route using adapter
    serverAdapter.registerRoute(server, method, path, wrappedHandler);

    // Log route registration with clear auth status
    const handlerLabel = handlerName || "default";
    const authStatus = requiresAuth 
      ? ` [SECURED${endpoint.auth?.roles ? `, roles: ${endpoint.auth.roles.join(", ")}` : ""}]`
      : " [PUBLIC]";
    
    console.log(
      `✅ Registered route: ${method.toUpperCase()} ${path} -> ${handlerLabel}${authStatus}${description ? ` (${description})` : ""}${params ? ` [validates path params]` : ""}${query ? ` [validates query params]` : ""}${body?.type ? ` [validates body: ${body.type}]` : ""}${response?.type ? ` [validates response: ${response.type}]` : ""}`
    );
  }
}

export interface YamaServer {
  stop: () => Promise<void>;
  port: number;
}

export async function startYamaNodeRuntime(
  port = 3000,
  yamlConfigPath?: string,
  environment?: string
): Promise<YamaServer> {
  // Register HTTP server adapter (always needed)
  registerHttpServerAdapter("fastify", (options) => createFastifyAdapter(options));

  // Create schema validator
  const validator = createSchemaValidator();
  
  // Store loaded plugins
  const loadedPlugins = new Map<string, YamaPlugin>();
  
  // Rate limiter (initialized later if config has rateLimit)
  let globalRateLimiter: RateLimiter | null = null;
  
  // Cache adapter (initialized from cache plugin if available)
  let cacheAdapter: unknown = null;

  // Load and parse YAML config if provided
  let config: YamaConfig | null = null;
  let handlersDir: string | null = null;
  let configDir: string | null = null;
  let dbAdapter: ReturnType<typeof createDatabaseAdapter> | null = null;
  let serverAdapter: ReturnType<typeof createHttpServerAdapter> | null = null;
  let server: unknown = null;

  if (yamlConfigPath) {
    try {
      // Load .env file before parsing config (with environment support)
      loadEnvFile(yamlConfigPath, environment);
      
      const configFile = readFileSync(yamlConfigPath, "utf-8");
      config = yaml.load(configFile) as YamaConfig;
      
      // Resolve environment variables in config
      config = resolveEnvVars(config) as YamaConfig;
      
      console.log("✅ Loaded YAML config");

      // Load plugins from config
      if (config.plugins) {
        const pluginList = Array.isArray(config.plugins) 
          ? config.plugins 
          : Object.keys(config.plugins);
        
        for (const pluginName of pluginList) {
          try {
            const plugin = await loadPlugin(pluginName);
            const pluginConfig = typeof config.plugins === "object" && !Array.isArray(config.plugins)
              ? config.plugins[pluginName] || {}
              : {};
            
            // Initialize plugin (this registers adapters, etc.)
            const pluginApi = await plugin.init(pluginConfig);
            
            // Store plugin and its API
            loadedPlugins.set(pluginName, plugin);
            
            // Call onInit lifecycle hook if present
            if (plugin.onInit) {
              await plugin.onInit(pluginConfig);
            }
            
            console.log(`✅ Loaded plugin: ${pluginName}`);
            
            // If this is a database plugin, initialize the database connection
            if (plugin.category === "database" && pluginApi && typeof pluginApi === "object" && "adapter" in pluginApi) {
              try {
                // Determine dialect from plugin name
                let dialect: string;
                if (pluginName.includes("pglite")) {
                  dialect = "pglite";
                } else if (pluginName.includes("postgres")) {
                  dialect = "postgresql";
                } else {
                  // Try to infer from plugin name or use a default
                  dialect = "postgresql";
                }
                
                // Build database config from plugin config
                // Resolve environment variables in URL if present
                const dbConfig: DatabaseConfig = {
                  dialect: dialect as "postgresql" | "pglite",
                  ...pluginConfig,
                };
                
                if (typeof dbConfig.url === "string" && dbConfig.url.includes("${")) {
                  dbConfig.url = resolveEnvVars(dbConfig.url) as string;
                }
                
                // Initialize database adapter
                // For PGlite, URL is optional (defaults to in-memory)
                // For PostgreSQL, URL is required
                if (dialect === "pglite") {
                  // PGlite can work without URL - defaults to in-memory
                  dbAdapter = createDatabaseAdapter(dialect, dbConfig);
                  await dbAdapter.init(dbConfig);
                  // Register global database adapter for auth providers
                  registerGlobalDatabaseAdapter(dbAdapter);
                  console.log("✅ Database connection initialized (pglite - in-memory)");
                } else if (dbConfig.url && !dbConfig.url.includes("user:password")) {
                  // PostgreSQL requires URL
                  dbAdapter = createDatabaseAdapter(dialect, dbConfig);
                  await dbAdapter.init(dbConfig);
                  // Register global database adapter for auth providers
                  registerGlobalDatabaseAdapter(dbAdapter);
                  console.log("✅ Database connection initialized (postgresql)");
                } else {
                  console.log("⚠️  Database URL not configured - running without database");
                }
              } catch (error) {
                console.warn("⚠️  Failed to initialize database (continuing without DB):", error instanceof Error ? error.message : String(error));
              }
            }
            
            // If this is a cache plugin, store the cache adapter
            if (plugin.category === "cache" && pluginApi && typeof pluginApi === "object" && "adapter" in pluginApi) {
              cacheAdapter = pluginApi.adapter;
              console.log("✅ Cache adapter initialized");
            }
          } catch (error) {
            console.warn(`⚠️  Failed to load plugin ${pluginName}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }


      // Convert entities to schemas and merge with explicit schemas
      const entitySchemas = config.entities ? entitiesToSchemas(config.entities) : {};
      
      // Generate CRUD input schemas and array schemas for entities with CRUD enabled
      if (config.entities) {
        const crudInputSchemas: YamaSchemas = {};
        const crudArraySchemas: YamaSchemas = {};
        
        for (const [entityName, entityDef] of Object.entries(config.entities)) {
          if (entityDef.crud) {
            const inputSchemas = generateCrudInputSchemas(entityName, entityDef);
            const arraySchemas = generateArraySchema(entityName, entityDef);
            Object.assign(crudInputSchemas, inputSchemas);
            Object.assign(crudArraySchemas, arraySchemas);
          }
        }
        
        // Merge: entity schemas -> CRUD input schemas -> CRUD array schemas -> explicit schemas
        const mergedWithInputs = mergeSchemas(crudInputSchemas, entitySchemas);
        const mergedWithArrays = mergeSchemas(crudArraySchemas, mergedWithInputs);
        const allSchemas = mergeSchemas(config.schemas, mergedWithArrays);
        
        // Register schemas for validation
        if (Object.keys(allSchemas).length > 0) {
          validator.registerSchemas(allSchemas);
          console.log(`✅ Registered ${Object.keys(allSchemas).length} schema(s) for validation`);
        }
        
        // Generate CRUD endpoints and merge with existing endpoints
        const crudEndpoints = generateAllCrudEndpoints(config.entities);
        if (crudEndpoints.length > 0) {
          // Convert CrudEndpoint[] to YamaConfig["endpoints"] format
          const convertedCrudEndpoints: NonNullable<YamaConfig["endpoints"]> = crudEndpoints.map(ep => ({
            path: ep.path,
            method: ep.method,
            description: ep.description,
            params: ep.params,
            query: ep.query,
            body: ep.body,
            response: ep.response,
            auth: ep.auth,
            // No handler specified - will use default handler
          }));
          
          // Merge CRUD endpoints with existing endpoints
          config.endpoints = [
            ...(config.endpoints || []),
            ...convertedCrudEndpoints,
          ];
          
          console.log(`✅ Generated ${crudEndpoints.length} CRUD endpoint(s) from entities`);
        }
      } else {
        const allSchemas = mergeSchemas(config.schemas, entitySchemas);
        
        // Register schemas for validation
        if (Object.keys(allSchemas).length > 0) {
          validator.registerSchemas(allSchemas);
          console.log(`✅ Registered ${Object.keys(allSchemas).length} schema(s) for validation`);
        }
      }

      // Determine handlers directory (src/handlers relative to YAML file)
      configDir = dirname(yamlConfigPath);
      handlersDir = join(configDir, "src", "handlers");
    } catch (error) {
      console.error("❌ Failed to load YAML config:", error);
    }
  }

  // Load entity repositories for handler context
  let repositories: Record<string, unknown> = {};
  if (config?.entities && configDir) {
    try {
      repositories = await loadRepositories(configDir, config.entities);
      if (Object.keys(repositories).length > 0) {
        console.log(`✅ Loaded ${Object.keys(repositories).length} repository/repositories for handler context`);
      }
    } catch (error) {
      console.warn(
        "⚠️  Failed to load repositories (handlers can still use manual imports):",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Initialize rate limiter if global config is provided
  if (config?.rateLimit) {
    try {
      // Use cache adapter if available (works with any cache implementation)
      globalRateLimiter = await createRateLimiterFromConfig(config.rateLimit, cacheAdapter as any);
      console.log("✅ Initialized rate limiter");
    } catch (error) {
      console.warn(`⚠️  Failed to initialize rate limiter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Create HTTP server adapter
  const serverEngine = config?.server?.engine || "fastify";
  if (serverEngine !== "fastify") {
    throw new Error(`Unsupported server engine: ${serverEngine}. Only "fastify" is supported.`);
  }
  serverAdapter = createHttpServerAdapter("fastify", config?.server?.options);
  server = serverAdapter.createServer(config?.server?.options);

  // Register built-in routes using adapter
  serverAdapter.registerRoute(server, "GET", "/health", async (request: HttpRequest, reply: HttpResponse) => {
    return {
      status: "ok",
      core: helloYamaCore(),
      configLoaded: config !== null
    };
  });

  serverAdapter.registerRoute(server, "GET", "/config", async (request: HttpRequest, reply: HttpResponse) => {
    return { config };
  });

  serverAdapter.registerRoute(server, "GET", "/openapi.json", async (request: HttpRequest, reply: HttpResponse) => {
    if (!config) {
      reply.status(404).send({ error: "No config loaded" });
      return;
    }
    const openAPISpec = generateOpenAPI(config);
    reply.type("application/json").send(openAPISpec);
  });

  serverAdapter.registerRoute(server, "GET", "/docs", async (request: HttpRequest, reply: HttpResponse) => {
    if (!config) {
      reply.status(404).send({ error: "No config loaded" });
      return;
    }
    const openAPISpec = generateOpenAPI(config);
    const specJson = JSON.stringify(openAPISpec, null, 2);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.name || "API"} - API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ${specJson};
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
    
    reply.type("text/html").send(html);
  });

  // Register OAuth endpoints if auto-generation is enabled
  if (config?.auth?.providers) {
    const oauthProviders = getAllOAuthProviders();
    for (const provider of config.auth.providers) {
      // Check if this is an OAuth provider
      if (provider.type.startsWith("oauth-")) {
        const oauthMetadata = oauthProviders.get(provider.type.toLowerCase());
        const autoGenerate = provider.autoGenerateEndpoints !== false; // Default to true
        
        if (oauthMetadata && autoGenerate) {
          const providerName = provider.type.replace("oauth-", "");
          
          // Register OAuth initiation endpoint
          serverAdapter.registerRoute(
            server,
            "GET",
            `/auth/${providerName}`,
            async (request: HttpRequest, reply: HttpResponse) => {
              if (oauthMetadata.handleOAuthFlow) {
                return await oauthMetadata.handleOAuthFlow(request, reply);
              }
              reply.status(501).send({ error: "OAuth flow not implemented" });
            }
          );
          
          // Register OAuth callback endpoint
          const callbackPath = oauthMetadata.callbackPath || `/auth/${providerName}/callback`;
          serverAdapter.registerRoute(
            server,
            "GET",
            callbackPath,
            async (request: HttpRequest, reply: HttpResponse) => {
              if (oauthMetadata.handleOAuthFlow) {
                return await oauthMetadata.handleOAuthFlow(request, reply);
              }
              reply.status(501).send({ error: "OAuth callback not implemented" });
            }
          );
          
          console.log(`✅ Auto-generated OAuth endpoints for ${provider.type}`);
        }
      }
    }
  }

  // Load handlers and register routes
  if (config?.endpoints && handlersDir && serverAdapter && configDir) {
    const handlers = await loadHandlers(handlersDir, configDir);
    registerRoutes(serverAdapter, server, config, handlers, validator, globalRateLimiter, repositories, dbAdapter || null);
  }

  // Call onStart lifecycle hooks for all plugins
  for (const plugin of loadedPlugins.values()) {
    if (plugin.onStart) {
      try {
        await plugin.onStart();
      } catch (error) {
        console.warn(`⚠️  Plugin ${plugin.name} onStart hook failed:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  await serverAdapter.start(server, port, "0.0.0.0");
  console.log(`Yama runtime listening on http://localhost:${port} (${serverEngine})`);

  return {
    stop: async () => {
      // Call onStop lifecycle hooks for all plugins
      for (const plugin of loadedPlugins.values()) {
        if (plugin.onStop) {
          try {
            await plugin.onStop();
          } catch (error) {
            console.warn(`⚠️  Plugin ${plugin.name} onStop hook failed:`, error instanceof Error ? error.message : String(error));
          }
        }
      }
      
      await serverAdapter?.stop(server);
      if (dbAdapter) {
        await dbAdapter.close();
      }
    },
    port
  };
}

