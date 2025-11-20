import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { helloYamaCore, createModelValidator, type YamaModels, type ValidationResult } from "@yama/core";
import yaml from "js-yaml";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, extname, resolve } from "path";
import { pathToFileURL } from "url";

interface YamaConfig {
  name?: string;
  version?: string;
  models?: YamaModels;
  endpoints?: Array<{
    path: string;
    method: string;
    handler: string;
    description?: string;
    body?: {
      type: string;
    };
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
 * Register routes from YAML config with validation
 */
function registerRoutes(
  app: ReturnType<typeof Fastify>,
  config: YamaConfig,
  handlers: Record<string, HandlerFunction>,
  validator: ReturnType<typeof createModelValidator>
) {
  if (!config.endpoints) {
    return;
  }

  for (const endpoint of config.endpoints) {
    const { path, method, handler: handlerName, description, body } = endpoint;
    const handlerFn = handlers[handlerName];

    if (!handlerFn) {
      console.warn(
        `⚠️  Handler "${handlerName}" not found for ${method} ${path}`
      );
      continue;
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
        
        // TODO: Validate response if response model is specified
        return result;
      } catch (error) {
        console.error(`Error in handler ${handlerName}:`, error);
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    console.log(
      `✅ Registered route: ${method.toUpperCase()} ${path} -> ${handlerName}${description ? ` (${description})` : ""}${body?.type ? ` [validates: ${body.type}]` : ""}`
    );
  }
}

export async function startYamaNodeRuntime(
  port = 3000,
  yamlConfigPath?: string
) {
  const app = Fastify();

  // Create model validator
  const validator = createModelValidator();

  // Load and parse YAML config if provided
  let config: YamaConfig | null = null;
  let handlersDir: string | null = null;

  if (yamlConfigPath) {
    try {
      const configFile = readFileSync(yamlConfigPath, "utf-8");
      config = yaml.load(configFile) as YamaConfig;
      console.log("✅ Loaded YAML config");

      // Register models for validation
      if (config.models) {
        validator.registerModels(config.models);
        console.log(`✅ Registered ${Object.keys(config.models).length} model(s) for validation`);
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

  // Load handlers and register routes
  if (config?.endpoints && handlersDir) {
    const handlers = await loadHandlers(handlersDir);
    registerRoutes(app, config, handlers, validator);
  }

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Yama runtime listening on http://localhost:${port}`);
}

