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
  loadPlugin,
  type YamaPlugin,
} from "@yama/core";
import { generateOpenAPI } from "@yama/docs-generator";
import { createFastifyAdapter } from "@yama/http-fastify";
import yaml from "js-yaml";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, extname, resolve } from "path";
import { pathToFileURL } from "url";

interface YamaConfig {
  name?: string;
  version?: string;
  schemas?: YamaSchemas;
  entities?: YamaEntities;
  database?: DatabaseConfig;
  server?: ServerConfig;
  auth?: AuthConfig;
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
  }>;
}

type HandlerFunction = RouteHandler;

/**
 * Load all handler functions from the handlers directory
 */
async function loadHandlers(handlersDir: string): Promise<Record<string, HandlerFunction>> {
  const handlers: Record<string, HandlerFunction> = {};

  if (!existsSync(handlersDir)) {
    console.warn(`⚠️  Handlers directory not found: ${handlersDir}`);
    return handlers;
  }

  try {
    const files = readdirSync(handlersDir);
    const tsFiles = files.filter(
      (file) => extname(file) === ".ts" || extname(file) === ".js"
    );

    for (const file of tsFiles) {
      const handlerName = file.replace(/\.(ts|js)$/, "");
      const handlerPath = join(handlersDir, file);

      try {
        // Convert to absolute path and then to file URL for ES module import
        const absolutePath = resolve(handlerPath);
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
function createDefaultHandler(
  endpoint: NonNullable<YamaConfig["endpoints"]>[number],
  responseType?: string
): HandlerFunction {
  return async (request: HttpRequest, reply: HttpResponse) => {
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
 * Register routes from YAML config with validation
 */
function registerRoutes(
  serverAdapter: ReturnType<typeof createHttpServerAdapter>,
  server: unknown,
  config: YamaConfig,
  handlers: Record<string, HandlerFunction>,
  validator: ReturnType<typeof createSchemaValidator>
) {
  if (!config.endpoints) {
    return;
  }

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

    // Wrap handler with validation and auth
    // Note: Handlers can use either normalized HttpRequest/HttpResponse or original engine types
    const wrappedHandler: RouteHandler = async (request: HttpRequest, reply: HttpResponse) => {
      try {
        // Get original request/reply for compatibility with existing handlers
        const originalRequest = (request as HttpRequest & { _original?: unknown })._original;
        const originalReply = (reply as HttpResponse & { _original?: unknown })._original;

        // Authenticate and authorize request
        if (config.auth || endpoint.auth) {
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

          // Attach auth context to request for handlers to use
          (request as HttpRequest & { auth: typeof authResult.context }).auth = authResult.context;
          // Also attach to original request if available
          if (originalRequest) {
            (originalRequest as { auth: typeof authResult.context }).auth = authResult.context;
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

        // Call handler - handlers can use normalized types or access _original for engine-specific types
        // For backward compatibility with Fastify handlers, we pass the normalized types
        // but handlers can access request._original and reply._original if needed
        const result = await handlerFn(request, reply);
        
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

    const handlerLabel = handlerName || "default";
    console.log(
      `✅ Registered route: ${method.toUpperCase()} ${path} -> ${handlerLabel}${description ? ` (${description})` : ""}${params ? ` [validates path params]` : ""}${query ? ` [validates query params]` : ""}${body?.type ? ` [validates body: ${body.type}]` : ""}${response?.type ? ` [validates response: ${response.type}]` : ""}${endpoint.auth ? ` [auth: ${endpoint.auth.required !== false ? "required" : "optional"}${endpoint.auth.roles ? `, roles: ${endpoint.auth.roles.join(", ")}` : ""}]` : ""}`
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

  // Load and parse YAML config if provided
  let config: YamaConfig | null = null;
  let handlersDir: string | null = null;
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
          } catch (error) {
            console.warn(`⚠️  Failed to load plugin ${pluginName}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }

      // Initialize database if configured
      if (config.database) {
        try {
          // Resolve environment variables in database URL
          const dbConfig = { ...config.database };
          if (typeof dbConfig.url === "string" && dbConfig.url.includes("${")) {
            dbConfig.url = resolveEnvVars(dbConfig.url) as string;
          }
          
          // For PostgreSQL, URL is required
          if (dbConfig.url && !dbConfig.url.includes("user:password")) {
            if (dbConfig.dialect !== "postgresql") {
              throw new Error(`Unsupported database dialect: ${dbConfig.dialect}. Supported dialects: "postgresql"`);
            }
            try {
              dbAdapter = createDatabaseAdapter("postgresql", dbConfig);
              await dbAdapter.init(dbConfig);
            } catch (adapterError) {
              // If adapter creation fails, it might be because the plugin didn't load
              if (adapterError instanceof Error && adapterError.message.includes("Unsupported database dialect")) {
                const pluginName = config.plugins && typeof config.plugins === "object" && !Array.isArray(config.plugins)
                  ? Object.keys(config.plugins).find(name => name.includes("db-postgres")) || "@yama/db-postgres"
                  : "@yama/db-postgres";
                throw new Error(`Database adapter not registered. The database plugin (${pluginName}) may have failed to load. Check the plugin loading errors above.`);
              }
              throw adapterError;
            }
            
            // Detect if using in-memory PGlite
            const isInMemory = dbConfig.url === ":memory:" || dbConfig.url === "pglite";
            if (isInMemory) {
              console.log("✅ Database connection initialized (postgresql via PGlite - in-memory)");
            } else {
              console.log("✅ Database connection initialized (postgresql)");
            }
          } else {
            console.log("⚠️  Database URL not configured or invalid - running without database");
          }
        } catch (error) {
          console.warn("⚠️  Failed to initialize database (continuing without DB):", error instanceof Error ? error.message : String(error));
        }
      }

      // Convert entities to schemas and merge with explicit schemas
      const entitySchemas = config.entities ? entitiesToSchemas(config.entities) : {};
      const allSchemas = mergeSchemas(config.schemas, entitySchemas);

      // Register schemas for validation
      if (Object.keys(allSchemas).length > 0) {
        validator.registerSchemas(allSchemas);
        console.log(`✅ Registered ${Object.keys(allSchemas).length} schema(s) for validation`);
      }

      // Determine handlers directory (src/handlers relative to YAML file)
      const configDir = dirname(yamlConfigPath);
      handlersDir = join(configDir, "src", "handlers");
    } catch (error) {
      console.error("❌ Failed to load YAML config:", error);
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

  // Load handlers and register routes
  if (config?.endpoints && handlersDir && serverAdapter) {
    const handlers = await loadHandlers(handlersDir);
    registerRoutes(serverAdapter, server, config, handlers, validator);
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

