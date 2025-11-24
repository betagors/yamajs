import Fastify from "fastify";
import { helloYamaCore, createModelValidator, fieldToJsonSchema } from "@betagors/yama-core";
import yaml from "js-yaml";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, extname, resolve } from "path";
import { pathToFileURL } from "url";
/**
 * Load all handler functions from the handlers directory
 */
async function loadHandlers(handlersDir) {
    const handlers = {};
    if (!existsSync(handlersDir)) {
        console.warn(`⚠️  Handlers directory not found: ${handlersDir}`);
        return handlers;
    }
    try {
        const files = readdirSync(handlersDir);
        const tsFiles = files.filter((file) => extname(file) === ".ts" || extname(file) === ".ts");
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
                }
                else {
                    console.warn(`⚠️  Handler ${handlerName} does not export a function`);
                }
            }
            catch (error) {
                console.error(`❌ Failed to load handler ${handlerName}:`, error);
            }
        }
    }
    catch (error) {
        console.error(`❌ Failed to read handlers directory:`, error);
    }
    return handlers;
}
/**
 * Build a JSON schema for query parameter validation
 */
function buildQuerySchema(queryParams, models) {
    const properties = {};
    const required = [];
    for (const [paramName, paramField] of Object.entries(queryParams)) {
        // Convert the field directly to JSON schema
        properties[paramName] = fieldToJsonSchema(paramField, paramName, models);
        if (paramField.required) {
            required.push(paramName);
        }
    }
    const schema = {
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
function coerceParams(params, paramDefs, models) {
    const coerced = {};
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
            }
            else if (!paramDef.required) {
                // Optional param with no value, skip it
                continue;
            }
            coerced[key] = value;
            continue;
        }
        const type = paramDef.$ref ?
            (models?.[paramDef.$ref]?.fields ? "object" : undefined) :
            paramDef.type;
        switch (type) {
            case "boolean":
                // Handle string "true"/"false" or actual booleans
                if (typeof value === "string") {
                    coerced[key] = value.toLowerCase() === "true" || value === "1";
                }
                else {
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
 * Register routes from YAML config with validation
 */
function registerRoutes(app, config, handlers, validator) {
    if (!config.endpoints) {
        return;
    }
    for (const endpoint of config.endpoints) {
        const { path, method, handler: handlerName, description, params, body, query, response } = endpoint;
        const handlerFn = handlers[handlerName];
        if (!handlerFn) {
            console.warn(`⚠️  Handler "${handlerName}" not found for ${method} ${path}`);
            continue;
        }
        const methodLower = method.toLowerCase();
        // Register the route with Fastify
        app[methodLower](path, async (request, reply) => {
            try {
                // Validate and coerce path parameters if specified
                if (params && Object.keys(params).length > 0) {
                    const pathParams = request.params;
                    const coercedParams = coerceParams(pathParams, params, config.models);
                    // Build a temporary schema for path parameter validation
                    const paramsSchema = buildQuerySchema(params, config.models);
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
                    const queryParams = request.query;
                    const coercedQuery = coerceParams(queryParams, query, config.models);
                    // Build a temporary schema for query validation
                    const querySchema = buildQuerySchema(query, config.models);
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
                const result = await handlerFn(request, reply);
                // Validate response if response model is specified
                if (response?.type && result !== undefined) {
                    const responseValidation = validator.validate(response.type, result);
                    if (!responseValidation.valid) {
                        console.error(`❌ Response validation failed for ${handlerName}:`, responseValidation.errors);
                        // In development, return validation errors; in production, log and return generic error
                        if (process.env.NODE_ENV === "development") {
                            reply.status(500).send({
                                error: "Response validation failed",
                                message: validator.formatErrors(responseValidation.errors || []),
                                errors: responseValidation.errors
                            });
                            return;
                        }
                        else {
                            reply.status(500).send({
                                error: "Internal server error",
                                message: "Response does not match expected schema"
                            });
                            return;
                        }
                    }
                }
                return result;
            }
            catch (error) {
                console.error(`Error in handler ${handlerName}:`, error);
                reply.status(500).send({
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : String(error)
                });
            }
        });
        console.log(`✅ Registered route: ${method.toUpperCase()} ${path} -> ${handlerName}${description ? ` (${description})` : ""}${params ? ` [validates path params]` : ""}${query ? ` [validates query params]` : ""}${body?.type ? ` [validates body: ${body.type}]` : ""}${response?.type ? ` [validates response: ${response.type}]` : ""}`);
    }
}
export async function startYamaNodeRuntime(port = 3000, yamlConfigPath) {
    const app = Fastify();
    // Create model validator
    const validator = createModelValidator();
    // Load and parse YAML config if provided
    let config = null;
    let handlersDir = null;
    if (yamlConfigPath) {
        try {
            const configFile = readFileSync(yamlConfigPath, "utf-8");
            config = yaml.load(configFile);
            console.log("✅ Loaded YAML config");
            // Register models for validation
            if (config.models) {
                validator.registerModels(config.models);
                console.log(`✅ Registered ${Object.keys(config.models).length} model(s) for validation`);
            }
            // Determine handlers directory (src/handlers relative to YAML file)
            const configDir = dirname(yamlConfigPath);
            handlersDir = join(configDir, "src", "handlers");
        }
        catch (error) {
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
//# sourceMappingURL=index.js.map