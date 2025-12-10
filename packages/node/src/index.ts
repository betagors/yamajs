/**
 * YAMA Node.js Runtime
 * 
 * Main entry point for the YAMA Node.js runtime.
 * Provides HTTP server with automatic CRUD, validation, auth, and more.
 * 
 * @module @betagors/yama-node
 */

// ===== Core imports =====
import {
  helloYamaCore,
  createSchemaValidator,
  type ValidationResult,
  entitiesToSchemas,
  mergeSchemas,
  loadEnvFile,
  resolveEnvVars,
  createDatabaseAdapter,
  createHttpServerAdapter,
  registerHttpServerAdapter,
  type HttpRequest,
  type HttpResponse,
  type YamaSchemas,
  type YamaEntities,
  loadPlugin,
  pluginRegistry,
  setPluginRegistryConfig,
  type YamaPlugin,
  generateAllCrudEndpoints,
  generateCrudInputSchemas,
  generateArraySchema,
  registerGlobalDatabaseAdapter,
  getAllOAuthProviders,
  type RateLimiter,
  createRateLimiterFromConfig,
  MiddlewareRegistry,
  loadMiddlewareFromFile,
  type MiddlewareDefinition,
  type DatabaseConfig,
  generateIR,
  setFileSystem,
  setPathModule,
  setEnvProvider,
  setCryptoProvider,
  setPasswordHasher,
} from "@betagors/yama-core";
import { createFastifyAdapter } from "@betagors/yama-fastify";
import yaml from "js-yaml";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import * as nodeFs from "fs";
import * as nodePath from "path";
import * as nodeCrypto from "crypto";
import bcrypt from "bcryptjs";

// ===== Module imports =====
import type { YamaConfig, YamaServer, EndpointDefinition } from "./types.js";
import { loadRepositories } from "./repository-loader.js";
import { registerRoutes } from "./route-registration.js";

// ===== Re-exports for convenience =====
export type { YamaConfig, YamaServer, EndpointDefinition };
export * from "./types.js";

function configureNodePlatformAdapters(): void {
  setFileSystem(nodeFs);
  setPathModule(nodePath);
  setEnvProvider({
    getEnv: (name: string) => process.env[name],
    setEnv: (name: string, value?: string) => {
      if (typeof value === "undefined") {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    },
    cwd: () => process.cwd(),
  });
  setCryptoProvider({
    randomBytes: (length: number) => new Uint8Array(nodeCrypto.randomBytes(length)),
    randomInt: (min: number, max: number) => nodeCrypto.randomInt(min, max),
    timingSafeEqual: (a: Uint8Array, b: Uint8Array) => {
      if (a.length !== b.length) {
        return false;
      }
      return nodeCrypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    },
  });
  setPasswordHasher({
    hash: (password: string, saltRounds = 12) => bcrypt.hash(password, saltRounds),
    verify: (password: string, hash: string) => bcrypt.compare(password, hash),
  });
}

/**
 * Dynamic import for OpenAPI package to handle workspace resolution
 * 
 * @internal
 */
async function getGenerateOpenAPI() {
  try {
    // @ts-ignore - dynamic import, package may not be available at compile time
    const openapiModule = await import("@betagors/yama-openapi");
    return openapiModule.generateOpenAPI;
  } catch (error) {
    throw new Error(
      `Failed to load @betagors/yama-openapi. Make sure it's built and available. ` +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Start YAMA Node.js runtime server
 * 
 * Creates and starts an HTTP server with:
 * - Automatic CRUD endpoints from entities
 * - Schema validation
 * - Authentication & authorization
 * - Rate limiting
 * - Middleware support
 * - Plugin system
 * - Monitoring & observability
 * 
 * @param port - Port to listen on (default: 3000)
 * @param yamlConfigPath - Path to yama.yaml configuration file
 * @param environment - Environment name (e.g., "development", "production")
 * @returns YamaServer instance with stop() method and port
 * 
 * @example
 * ```typescript
 * // Start server with configuration
 * const server = await startYamaNodeRuntime(3000, "./yama.yaml");
 * 
 * // Later, stop the server
 * await server.stop();
 * ```
 */
export async function startYamaNodeRuntime(
  port = 3000,
  yamlConfigPath?: string,
  environment?: string
): Promise<YamaServer> {
  configureNodePlatformAdapters();
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

  // Storage buckets (initialized from storage plugins)
  const storageBuckets: Record<string, any> = {};

  // Realtime adapter (initialized from realtime plugin if available)
  let realtimeAdapter: unknown = null;
  let realtimePluginApi: any = null;

  // Load and parse YAML config if provided
  let config: YamaConfig | null = null;
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
      config = resolveEnvVars(config as Record<string, unknown>) as YamaConfig;
      
      console.log("✅ Loaded YAML config");

      // Set registry configuration
      configDir = dirname(yamlConfigPath || process.cwd());
      setPluginRegistryConfig(config as Record<string, unknown>, configDir);

      // ===== Load plugins =====
      if (config.plugins) {
        // Plugins must be an array (new format only)
        if (!Array.isArray(config.plugins)) {
          throw new Error("plugins must be an array. Format: ['@plugin/name'] or [{ '@plugin/name': { config: {...} } }]");
        }

        // Extract plugin names and configs from array
        const pluginEntries: Array<{ name: string; config: Record<string, unknown> }> = [];
        
        for (const pluginItem of config.plugins) {
          if (typeof pluginItem === "string") {
            // String shorthand: "@betagors/yama-pglite"
            pluginEntries.push({ name: pluginItem, config: {} });
          } else if (pluginItem && typeof pluginItem === "object") {
            // Object format: { "@betagors/yama-redis": { config: {...} } }
            const pluginObj = pluginItem as Record<string, any>;
            const keys = Object.keys(pluginObj);
            if (keys.length !== 1) {
              throw new Error(`Plugin object must have exactly one key (plugin name), got: ${keys.join(", ")}`);
            }
            const pluginName = keys[0];
            const pluginValue = pluginObj[pluginName];
            const pluginConfig = pluginValue && typeof pluginValue === "object" && "config" in pluginValue
              ? (pluginValue.config as Record<string, unknown> || {})
              : {};
            pluginEntries.push({ name: pluginName, config: pluginConfig });
          } else {
            throw new Error(`Invalid plugin item: expected string or object, got ${typeof pluginItem}`);
          }
        }
        
        // Load database plugin first if present, so migrations for other plugins can run
        const dbPluginIndex = pluginEntries.findIndex((entry) => 
          entry.name.includes("postgres") || entry.name.includes("pglite") || entry.name.includes("database")
        );
        const orderedPlugins = dbPluginIndex >= 0
          ? [pluginEntries[dbPluginIndex], ...pluginEntries.filter((_, i) => i !== dbPluginIndex)]
          : pluginEntries;
        
        for (const { name: pluginName, config: pluginConfig } of orderedPlugins) {
          try {
            // Load plugin (init is called automatically with context in registry)
            const plugin = await loadPlugin(pluginName, configDir, pluginConfig);
            
            // Get plugin API (already initialized by registry)
            const pluginApi = pluginRegistry.getPluginAPI(pluginName);
            
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

            // If this is a storage plugin, collect storage buckets
            if (plugin.category === "storage" && pluginApi && typeof pluginApi === "object") {
              if ("buckets" in pluginApi && typeof pluginApi.buckets === "object" && pluginApi.buckets !== null) {
                // S3 plugin returns buckets object
                Object.assign(storageBuckets, pluginApi.buckets);
                console.log(`✅ Storage buckets initialized: ${Object.keys(pluginApi.buckets).join(", ")}`);
              } else if ("bucket" in pluginApi) {
                // FS plugin returns single bucket (also exposed as buckets.default)
                storageBuckets.default = pluginApi.bucket;
                console.log("✅ Storage bucket initialized (default)");
              }
            }

            // If this is a realtime plugin, store the adapter
            if (plugin.category === "realtime" && pluginApi && typeof pluginApi === "object" && "adapter" in pluginApi) {
              realtimeAdapter = pluginApi.adapter;
              realtimePluginApi = pluginApi;
              
              // Pass Redis client if available from cache plugin
              if (cacheAdapter && typeof (cacheAdapter as any).getRedisClient === "function") {
                const redisClient = (cacheAdapter as any).getRedisClient();
                if (redisClient && pluginApi.init) {
                  // Re-initialize with Redis client
                  const realtimeConfig = typeof config.plugins === "object" && !Array.isArray(config.plugins)
                    ? (config.plugins[pluginName] || {}) as any
                    : {};
                  realtimeConfig.redisClient = redisClient;
                  // Note: We can't re-init here, but we can pass it via the plugin API
                  // The plugin will check for redisClient in its setup
                }
              }
              
              console.log("✅ Realtime adapter initialized");
            }

            // If this is an email plugin, store the email service
            if (plugin.category === "email" && pluginApi && typeof pluginApi === "object" && "service" in pluginApi) {
              // Email service is available via pluginApi.service
              // It will be accessed via plugin registry context later
              console.log("✅ Email service initialized");
            }
          } catch (error) {
            console.warn(`⚠️  Failed to load plugin ${pluginName}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }

      // Get email service from email plugin (if available)
      let emailService: any = null;
      const emailPlugin = pluginRegistry.getPluginsByCategory("email")[0];
      if (emailPlugin) {
        const emailPluginApi = pluginRegistry.getPluginAPI(emailPlugin.name);
        if (emailPluginApi && typeof emailPluginApi === "object" && "service" in emailPluginApi) {
          emailService = emailPluginApi.service;
        }
      }

      // ===== Convert entities to schemas and merge =====
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
        
        // ===== Generate CRUD endpoints and merge with existing endpoints =====
        const crudEndpoints = generateAllCrudEndpoints(config.entities);
        if (crudEndpoints.length > 0) {
          // Convert CrudEndpoint[] to EndpointDefinition[] format
          const convertedCrudEndpoints: EndpointDefinition[] = crudEndpoints.map(ep => ({
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
          
          // Add CRUD endpoints to apis.rest.default
          if (!config.apis) {
            config.apis = {};
          }
          if (!config.apis.rest) {
            config.apis.rest = { default: { endpoints: [] } };
          }
          // Handle both single config and named configs
          if (Array.isArray((config.apis.rest as any).endpoints)) {
            // Single config
            (config.apis.rest as any).endpoints.push(...convertedCrudEndpoints);
          } else {
            // Named configs - add to default
            const restConfig = config.apis.rest as any;
            if (!restConfig.default) {
              restConfig.default = { endpoints: [] };
            }
            if (!restConfig.default.endpoints) {
              restConfig.default.endpoints = [];
            }
            restConfig.default.endpoints.push(...convertedCrudEndpoints);
          }
          
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

      // Determine config directory (directory containing yama.yaml)
      configDir = dirname(yamlConfigPath);
    } catch (error) {
      console.error("❌ Failed to load YAML config:", error);
    }
  }

  // ===== Load entity repositories =====
  // Combine entities and schemas with database properties for repository loading
  let allEntitiesForRepos: YamaEntities = config?.entities ? { ...config.entities } : {};
  if (config?.schemas) {
    for (const [schemaName, schemaDef] of Object.entries(config.schemas)) {
      // Treat schemas with database properties as entities
      if (schemaDef && typeof schemaDef === 'object' && (schemaDef.database || (schemaDef as any).table)) {
        allEntitiesForRepos[schemaName] = schemaDef as any;
      }
    }
  }
  
  console.log(`🔍 Repository loading: found ${Object.keys(allEntitiesForRepos).length} entities/schemas with database:`, Object.keys(allEntitiesForRepos));
  console.log(`🔍 configDir for repository loading:`, configDir);
  
  let repositories: Record<string, unknown> = {};
  if (Object.keys(allEntitiesForRepos).length > 0 && configDir) {
    try {
      repositories = await loadRepositories(configDir, allEntitiesForRepos);
      console.log(`🔍 After loadRepositories, repositories object has ${Object.keys(repositories).length} keys:`, Object.keys(repositories));
      if (Object.keys(repositories).length > 0) {
        console.log(`✅ Loaded ${Object.keys(repositories).length} repository/repositories for handler context`);
      } else {
        console.warn(`⚠️  No repositories were loaded. Check that 'yama generate' has been run.`);
      }
    } catch (error) {
      console.warn(
        "⚠️  Failed to load repositories (handlers can still use manual imports):",
        error instanceof Error ? error.message : String(error)
      );
    }
  } else {
    console.warn(`⚠️  Skipping repository loading: ${Object.keys(allEntitiesForRepos).length === 0 ? 'no entities found' : 'configDir missing'}`);
  }

  // ===== Initialize rate limiter =====
  if (config?.rateLimit) {
    try {
      // Use cache adapter if available (works with any cache implementation)
      globalRateLimiter = await createRateLimiterFromConfig(config.rateLimit as any, cacheAdapter as any);
      console.log("✅ Initialized rate limiter");
    } catch (error) {
      console.warn(`⚠️  Failed to initialize rate limiter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ===== Create middleware registry =====
  const middlewareRegistry = new MiddlewareRegistry();
  
  // Set middleware registry in plugin registry so plugins can access it
  pluginRegistry.setMiddlewareRegistry(middlewareRegistry);

  // ===== Load middleware from config =====
  if (config?.middleware) {
    try {
      // Load global middleware
      if (config.middleware.global) {
        for (const mwConfig of config.middleware.global) {
          if (mwConfig.enabled === false) {
            continue;
          }

          let handler: MiddlewareDefinition['handler'];
          
          // Check if it's plugin-provided middleware
          if (mwConfig.name.startsWith('@')) {
            const pluginAPI = pluginRegistry.getPluginAPI(mwConfig.name);
            if (pluginAPI && typeof pluginAPI.getMiddleware === 'function') {
              const pluginMw = pluginAPI.getMiddleware();
              if (Array.isArray(pluginMw)) {
                // Plugin returns array of middleware
                for (const mw of pluginMw) {
                  middlewareRegistry.register({
                    ...mw,
                    ...mwConfig, // Merge user config
                  });
                }
              } else {
                // Plugin returns single middleware
                middlewareRegistry.register({
                  ...pluginMw,
                  ...mwConfig, // Merge user config
                });
              }
              continue;
            } else {
              throw new Error(
                `Plugin middleware "${mwConfig.name}" not found. Plugin must expose getMiddleware() method.`
              );
            }
          }

          // File-based middleware
          if (mwConfig.file) {
            const handlerFn = await loadMiddlewareFromFile(mwConfig.file, configDir || process.cwd());
            handler = handlerFn;
          } else {
            throw new Error(
              `Middleware "${mwConfig.name}" must specify either a file path or be a plugin-provided middleware.`
            );
          }

          middlewareRegistry.register({
            name: mwConfig.name,
            handler,
            phases: mwConfig.phases || ['pre-handler'],
            priority: mwConfig.priority,
            enabled: mwConfig.enabled,
            config: mwConfig.config,
          });
        }
        console.log(`✅ Loaded ${config.middleware.global.filter(m => m.enabled !== false).length} global middleware`);
      }

      // Load endpoint-specific middleware
      if (config.middleware.endpoints) {
        for (const endpointMw of config.middleware.endpoints) {
          for (const mwConfig of endpointMw.middleware) {
            if (mwConfig.enabled === false) {
              continue;
            }

            let handler: MiddlewareDefinition['handler'];
            
            // Check if it's plugin-provided middleware
            if (mwConfig.name.startsWith('@')) {
              const pluginAPI = pluginRegistry.getPluginAPI(mwConfig.name);
              if (pluginAPI && typeof pluginAPI.getMiddleware === 'function') {
                const pluginMw = pluginAPI.getMiddleware();
                if (Array.isArray(pluginMw)) {
                  for (const mw of pluginMw) {
                    middlewareRegistry.register({
                      ...mw,
                      ...mwConfig,
                      endpointPath: endpointMw.path,
                      endpointMethod: endpointMw.method,
                    });
                  }
                } else {
                  middlewareRegistry.register({
                    ...pluginMw,
                    ...mwConfig,
                    endpointPath: endpointMw.path,
                    endpointMethod: endpointMw.method,
                  });
                }
                continue;
              } else {
                throw new Error(
                  `Plugin middleware "${mwConfig.name}" not found. Plugin must expose getMiddleware() method.`
                );
              }
            }

            // File-based middleware
            if (mwConfig.file) {
              const handlerFn = await loadMiddlewareFromFile(mwConfig.file, configDir || process.cwd());
              handler = handlerFn;
            } else {
              throw new Error(
                `Middleware "${mwConfig.name}" must specify either a file path or be a plugin-provided middleware.`
              );
            }

            middlewareRegistry.register({
              name: mwConfig.name,
              handler,
              phases: mwConfig.phases || ['pre-handler'],
              priority: mwConfig.priority,
              enabled: mwConfig.enabled,
              config: mwConfig.config,
              endpointPath: endpointMw.path,
              endpointMethod: endpointMw.method,
            });
          }
        }
        const endpointMwCount = config.middleware.endpoints.reduce(
          (sum, ep) => sum + ep.middleware.filter(m => m.enabled !== false).length,
          0
        );
        console.log(`✅ Loaded ${endpointMwCount} endpoint-specific middleware`);
      }
    } catch (error) {
      console.error(`❌ Failed to load middleware:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ===== Create HTTP server adapter =====
  const serverEngine = config?.server?.engine || "fastify";
  if (serverEngine !== "fastify") {
    throw new Error(`Unsupported server engine: ${serverEngine}. Only "fastify" is supported.`);
  }
  serverAdapter = createHttpServerAdapter("fastify", config?.server?.options);
  server = serverAdapter.createServer(config?.server?.options);

  // ===== Setup realtime WebSocket server =====
  if (realtimePluginApi && typeof realtimePluginApi.setupServer === "function") {
    try {
      await realtimePluginApi.setupServer(server, config?.auth);
      console.log("✅ Realtime WebSocket server initialized");
      
      // Register channels from config
      if (config?.realtime?.channels && realtimePluginApi.registerChannel) {
        for (const channel of config.realtime.channels) {
          realtimePluginApi.registerChannel(channel);
        }
        console.log(`✅ Registered ${config.realtime.channels.length} realtime channel(s)`);
      }
      
      // Setup entity events if configured
      if (config?.realtime?.entities && realtimePluginApi.setupEntityEvents) {
        realtimePluginApi.setupEntityEvents(config.realtime.entities, repositories);
        const entityCount = Object.keys(config.realtime.entities).filter(
          (name) => config.realtime?.entities?.[name]?.enabled
        ).length;
        if (entityCount > 0) {
          console.log(`✅ Enabled realtime events for ${entityCount} entity/entities`);
        }
      }
    } catch (error) {
      console.warn("⚠️  Failed to setup realtime WebSocket server:", error instanceof Error ? error.message : String(error));
    }
  }

  // ===== Register built-in routes =====
  serverAdapter.registerRoute(server, "GET", "/config", async (request: HttpRequest, reply: HttpResponse) => {
    return { config };
  });

  const nodeEnv = process.env.NODE_ENV || "development";
  const exposeIr = nodeEnv !== "production" || process.env.YAMA_EXPOSE_IR === "true";
  if (exposeIr) {
    serverAdapter.registerRoute(server, "GET", "/yama/ir", async (request: HttpRequest, reply: HttpResponse) => {
      if (!config) {
        reply.status(404).send({ error: "No config loaded" });
        return;
      }

      // In production, require explicit opt-in and token if provided
      const isProd = nodeEnv === "production";
      if (isProd && process.env.YAMA_EXPOSE_IR !== "true") {
        reply.status(404).send({ error: "Not found" });
        return;
      }

      if (isProd) {
        const token = process.env.YAMA_IR_TOKEN;
        if (token) {
          const authHeader = (request.headers?.authorization as string | undefined) || "";
          const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
          const xToken = (request.headers?.["x-yama-ir-token"] as string | undefined) || "";
          if (headerToken !== token && xToken !== token) {
            reply.status(401).send({ error: "Unauthorized" });
            return;
          }
        }
      }

      try {
        const ir = generateIR(config as any);
        reply.type("application/json").send(ir);
      } catch (error) {
        reply.status(500).send({
          error: "Failed to generate IR",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  serverAdapter.registerRoute(server, "GET", "/openapi.json", async (request: HttpRequest, reply: HttpResponse) => {
    if (!config) {
      reply.status(404).send({ error: "No config loaded" });
      return;
    }
    try {
      const generateOpenAPI = await getGenerateOpenAPI();
      const openAPISpec = generateOpenAPI(config as any);
      reply.type("application/json").send(openAPISpec);
    } catch (error) {
      reply.status(500).send({ 
        error: "Failed to generate OpenAPI spec",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  serverAdapter.registerRoute(server, "GET", "/docs", async (request: HttpRequest, reply: HttpResponse) => {
    if (!config) {
      reply.status(404).send({ error: "No config loaded" });
      return;
    }
    try {
      const generateOpenAPI = await getGenerateOpenAPI();
      const openAPISpec = generateOpenAPI(config as any);
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
    } catch (error) {
      reply.status(500).send({ 
        error: "Failed to generate OpenAPI spec",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ===== Register OAuth endpoints =====
  if (config?.auth?.providers) {
    const oauthProviders = getAllOAuthProviders();
    for (const provider of config.auth.providers) {
      // Check if this is an OAuth provider
      if (provider.type.startsWith("oauth-")) {
        const oauthMetadata = oauthProviders.get(provider.type.toLowerCase());
        const autoGenerate = (provider as any).autoGenerateEndpoints !== false; // Default to true
        
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

  // ===== Get monitoring services from plugins =====
  let loggerService: any = null;
  let metricsService: any = null;
  let monitoringService: any = null;
  let healthService: any = null;
  
  // Get logger service from logging plugin
  const loggingPlugin = pluginRegistry.getPluginsByCategory("logging")[0];
  if (loggingPlugin) {
    const loggingPluginApi = pluginRegistry.getPluginAPI(loggingPlugin.name);
    if (loggingPluginApi && typeof loggingPluginApi === "object" && "logger" in loggingPluginApi) {
      loggerService = loggingPluginApi.logger;
      
      // Apply monitoring log level if configured
      if (config?.monitoring?.level && typeof loggerService.setLevel === "function") {
        loggerService.setLevel(config.monitoring.level);
        console.log(`✅ Set monitoring log level to: ${config.monitoring.level}`);
      }
    }
  }
  
  // Get metrics service from metrics plugin
  const metricsPlugin = pluginRegistry.getPluginsByCategory("observability")?.find(p => p.name.includes("metrics"));
  if (metricsPlugin) {
    const metricsPluginApi = pluginRegistry.getPluginAPI(metricsPlugin.name);
    if (metricsPluginApi) {
      metricsService = metricsPluginApi;
      // Metrics plugin can also serve as monitoring service if it implements MonitoringHooks
      if (typeof metricsPluginApi === "object" && ("onRequestStart" in metricsPluginApi || "onRequestEnd" in metricsPluginApi || "onError" in metricsPluginApi)) {
        monitoringService = metricsPluginApi;
      }
      
      // Register custom metrics if configured
      if (config?.monitoring?.custom && Array.isArray(config.monitoring.custom)) {
        for (const customMetric of config.monitoring.custom) {
          try {
            if (customMetric.type === "counter") {
              metricsPluginApi.registerCounter(customMetric.name, []);
            } else if (customMetric.type === "gauge") {
              metricsPluginApi.registerGauge(customMetric.name, []);
            } else if (customMetric.type === "histogram") {
              metricsPluginApi.registerHistogram(customMetric.name, []);
            }
            console.log(`✅ Registered custom metric: ${customMetric.name} (${customMetric.type})`);
          } catch (error) {
            console.warn(`⚠️  Failed to register custom metric ${customMetric.name}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }
    }
  }
  
  // Get health service from health plugin
  const healthPlugin = pluginRegistry.getPluginsByCategory("observability")?.find(p => p.name.includes("health"));
  if (healthPlugin) {
    const healthPluginApi = pluginRegistry.getPluginAPI(healthPlugin.name);
    if (healthPluginApi) {
      healthService = healthPluginApi;
    }
  }

  // ===== Auto-register monitoring endpoints =====
  if (healthService) {
    // Get health path from plugin API config, default to /_health
    const healthPath = (healthService.getConfig && typeof healthService.getConfig === "function")
      ? healthService.getConfig().path || "/_health"
      : "/_health";
    
    serverAdapter.registerRoute(server, "GET", healthPath, async (request: HttpRequest, reply: HttpResponse) => {
      try {
        const healthStatus = await healthService.getHealth();
        reply.status(healthStatus.status || (healthStatus.healthy ? 200 : 503)).send(healthStatus);
      } catch (error) {
        reply.status(503).send({
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
    console.log(`✅ Registered health endpoint: GET ${healthPath}`);
  }
  
  if (metricsService) {
    serverAdapter.registerRoute(server, "GET", "/_metrics", async (request: HttpRequest, reply: HttpResponse) => {
      try {
        const metrics = metricsService.export("prometheus");
        reply.type("text/plain").send(metrics);
      } catch (error) {
        reply.status(500).send({
          error: "Failed to export metrics",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
    console.log(`✅ Registered metrics endpoint: GET /_metrics`);
  }

  // ===== Register AdminX dev UI (if plugin installed) =====
  const adminPlugin = pluginRegistry.getPluginsByCategory("devtools")?.find((p) => p.name === "@betagors/yama-adminx");
  if (adminPlugin) {
    const adminApi: any = pluginRegistry.getPluginAPI(adminPlugin.name);
    if (adminApi && typeof adminApi.registerRoutes === "function") {
      try {
        adminApi.registerRoutes({
          serverAdapter,
          server,
          config,
          configDir,
          projectDir: configDir || process.cwd(),
          entities: config?.entities,
          schemas: config?.schemas,
          repositories,
          nodeEnv,
        });
        const adminConfig = typeof adminApi.getConfig === "function" ? adminApi.getConfig() : null;
        const adminPath = adminConfig?.path || "/adminx";
        if (adminConfig?.enabled !== false) {
          console.log(`✅ Registered AdminX routes at ${adminPath}`);
        } else {
          console.log(`ℹ️  AdminX plugin disabled by config`);
        }
      } catch (error) {
        console.warn(
          "⚠️  Failed to register AdminX routes:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  // ===== Register routes from configuration =====
  const hasEndpoints = config && (config.endpoints || config.apis?.rest);
  if (hasEndpoints && serverAdapter && configDir && config) {
    // Get email service from email plugin (if available)
    let emailService: any = null;
    const emailPlugin = pluginRegistry.getPluginsByCategory("email")[0];
    if (emailPlugin) {
      const emailPluginApi = pluginRegistry.getPluginAPI(emailPlugin.name);
      if (emailPluginApi && typeof emailPluginApi === "object" && "service" in emailPluginApi) {
        emailService = emailPluginApi.service;
      }
    }
    
    await registerRoutes(
      serverAdapter,
      server,
      config,
      configDir,
      validator,
      globalRateLimiter,
      repositories,
      dbAdapter || null,
      cacheAdapter || null,
      storageBuckets,
      realtimeAdapter || null,
      middlewareRegistry,
      emailService,
      loggerService,
      metricsService,
      monitoringService
    );
  }

  // ===== Call onStart lifecycle hooks =====
  for (const plugin of loadedPlugins.values()) {
    if (plugin.onStart) {
      try {
        await plugin.onStart();
      } catch (error) {
        console.warn(`⚠️  Plugin ${plugin.name} onStart hook failed:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  // ===== Start server =====
  await serverAdapter.start(server, port, "0.0.0.0");
  console.log(`Yama runtime listening on http://localhost:${port} (${serverEngine})`);

  // ===== Return server control object =====
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

// Export for library usage
export default { startYamaNodeRuntime };
