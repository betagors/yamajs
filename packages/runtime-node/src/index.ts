import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { helloYamaCore, createSchemaValidator, type YamaSchemas, type ValidationResult, type SchemaField, fieldToJsonSchema, type AuthConfig, type EndpointAuth, authenticateAndAuthorize, type YamaEntities, type DatabaseConfig, entitiesToSchemas, mergeSchemas, loadEnvFile, resolveEnvVars } from "@yama/core";
import { generateOpenAPI } from "@yama/docs-generator";
import { initDatabase, closeDatabase } from "@yama/db-postgres";
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
  auth?: AuthConfig;
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

type HandlerFunction = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<unknown> | unknown;

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
  return async (request: FastifyRequest, reply: FastifyReply) => {
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
  app: ReturnType<typeof Fastify>,
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

    const methodLower = method.toLowerCase() as
      | "get"
      | "post"
      | "put"
      | "patch"
      | "delete"
      | "head"
      | "options";

    // Register the route with Fastify
    app[methodLower](path, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Authenticate and authorize request
        if (config.auth || endpoint.auth) {
          const headers: Record<string, string | undefined> = {};
          // Collect all headers (Fastify lowercases header names)
          for (const [key, value] of Object.entries(request.headers)) {
            headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
          }

          const authResult = await authenticateAndAuthorize(
            headers,
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
          (request as FastifyRequest & { auth: typeof authResult.context }).auth = authResult.context;
        }

        // Validate and coerce path parameters if specified
        if (params && Object.keys(params).length > 0) {
          const pathParams = request.params as Record<string, unknown>;
          const coercedParams = coerceParams(pathParams, params, config.schemas);
          
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
          request.params = coercedParams as typeof request.params;
        }

        // Validate and coerce query parameters if specified
        if (query && Object.keys(query).length > 0) {
          const queryParams = request.query as Record<string, unknown>;
          const coercedQuery = coerceParams(queryParams, query, config.schemas);
          
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
          request.query = coercedQuery as typeof request.query;
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
    });

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
  yamlConfigPath?: string
): Promise<YamaServer> {
  const app = Fastify();

  // Create schema validator
  const validator = createSchemaValidator();

  // Load and parse YAML config if provided
  let config: YamaConfig | null = null;
  let handlersDir: string | null = null;

  if (yamlConfigPath) {
    try {
      // Load .env file before parsing config
      loadEnvFile(yamlConfigPath);
      
      const configFile = readFileSync(yamlConfigPath, "utf-8");
      config = yaml.load(configFile) as YamaConfig;
      
      // Resolve environment variables in config
      config = resolveEnvVars(config) as YamaConfig;
      
      console.log("✅ Loaded YAML config");

      // Initialize database if configured
      if (config.database) {
        try {
          initDatabase(config.database);
          console.log("✅ Database connection initialized");
        } catch (error) {
          console.error("❌ Failed to initialize database:", error);
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

  app.get("/health", async () => ({
    status: "ok",
    core: helloYamaCore(),
    configLoaded: config !== null
  }));

  // Expose config for inspection
  app.get("/config", async () => ({
    config
  }));

  // Serve OpenAPI spec
  app.get("/openapi.json", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config) {
      reply.status(404).send({ error: "No config loaded" });
      return;
    }
    const openAPISpec = generateOpenAPI(config);
    reply.type("application/json").send(openAPISpec);
  });

  // Serve Swagger UI
  app.get("/docs", async (request: FastifyRequest, reply: FastifyReply) => {
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
  if (config?.endpoints && handlersDir) {
    const handlers = await loadHandlers(handlersDir);
    registerRoutes(app, config, handlers, validator);
  }

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Yama runtime listening on http://localhost:${port}`);

  return {
    stop: async () => {
      await app.close();
      await closeDatabase();
    },
    port
  };
}

