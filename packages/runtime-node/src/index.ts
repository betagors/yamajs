import {
  helloYamaCore,
  createSchemaValidator,
  type YamaSchemas,
  type ValidationResult,
  type SchemaField,
  fieldToJsonSchema,
  type AuthConfig,
  type EndpointAuth,
  type AuthContext,
  authenticateAndAuthorize,
  type YamaEntities,
  type EntityField,
  type EntityDefinition,
  type CrudConfig,
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
  type StorageBucket,
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
  type PaginationConfig,
  normalizePaginationConfig,
  calculatePaginationMetadata,
  wrapPaginatedResponse,
  detectPaginationFromQuery,
} from "@betagors/yama-core";
import { createFastifyAdapter } from "@betagors/yama-fastify";

// Dynamic import for openapi package to handle workspace resolution
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
  realtime?: {
    entities?: Record<string, {
      enabled?: boolean;
      events?: ("created" | "updated" | "deleted")[];
      watchFields?: string[];
      channelPrefix?: string;
    }>;
    channels?: Array<{
      name: string;
      path: string;
      auth?: {
        required?: boolean;
        handler?: string;
      };
      params?: Record<string, {
        type: string;
        required?: boolean;
      }>;
    }>;
  };
  endpoints?: Array<{
    path: string;
    method: string;
    handler?: string | {
      type: "query";
      entity: string;
      filters?: Array<{
        field: string;
        operator: "eq" | "ilike" | "gt" | "gte" | "lt" | "lte";
        param: string; // References query param or path param (e.g., "query.search" or "params.id")
      }>;
      pagination?: PaginationConfig;
      orderBy?: {
        field: string;
        direction?: "asc" | "desc";
      } | string; // Can be "query.orderBy" to read from query params
    }; // Optional - if not provided, uses default handler
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
  authContext?: AuthContext,
  repositories?: Record<string, unknown>,
  dbAdapter?: unknown,
  cacheAdapter?: unknown,
  storage?: Record<string, StorageBucket>,
  realtimeAdapter?: unknown
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
    
    // Storage access
    storage: storage,
    
    // Realtime access
    realtime: realtimeAdapter ? {
      publish: async (channel: string, event: string, data: unknown, options?: { userId?: string; excludeUserId?: string }) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.publish === "function") {
          return await adapter.publish(channel, event, data, options);
        }
        throw new Error("Realtime adapter not available");
      },
      publishAsync: (channel: string, event: string, data: unknown, options?: { userId?: string; excludeUserId?: string }) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.publishAsync === "function") {
          adapter.publishAsync(channel, event, data, options);
        }
      },
      broadcast: async (channel: string, event: string, data: unknown, options?: { userId?: string; excludeUserId?: string }) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.broadcast === "function") {
          return await adapter.broadcast(channel, event, data, options);
        }
        throw new Error("Realtime adapter not available");
      },
      getClients: async (channel: string) => {
        const adapter = realtimeAdapter as any;
        if (adapter && typeof adapter.getClients === "function") {
          return await adapter.getClients(channel);
        }
        return [];
      },
      get available() {
        return realtimeAdapter !== null && realtimeAdapter !== undefined;
      },
    } : undefined,
    
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

/**
 * Extract entity name from response type
 * Handles patterns like "ProductArray" -> "Product" or "Product" -> "Product"
 */
function extractEntityNameFromResponseType(
  responseType: string,
  entities: YamaEntities
): string | null {
  // Try direct match first (e.g., "Product")
  if (entities[responseType]) {
    return responseType;
  }

  // Try removing "Array" suffix (e.g., "ProductArray" -> "Product")
  if (responseType.endsWith("Array")) {
    const entityName = responseType.slice(0, -5); // Remove "Array"
    if (entities[entityName]) {
      return entityName;
    }
  }

  return null;
}

/**
 * Get API field name from entity field definition
 */
function getApiFieldNameFromEntity(fieldName: string, field: EntityField): string {
  // Use explicit api name if provided
  if (field.api && typeof field.api === "string") {
    return field.api;
  }

  // Convert dbColumn to camelCase if provided
  if (field.dbColumn) {
    return field.dbColumn.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  // Use field name as-is
  return fieldName;
}

/**
 * Get primary key field name from entity definition
 */
function getPrimaryKeyFieldName(entityDef: EntityDefinition): string {
  for (const [fieldName, field] of Object.entries(entityDef.fields)) {
    if (field.primary) {
      return getApiFieldNameFromEntity(fieldName, field);
    }
  }
  return "id"; // Default fallback
}

/**
 * Map query parameters to repository findAll options
 */
function mapQueryToFindAllOptions(
  query: Record<string, unknown>,
  entityDef: EntityDefinition,
  entityConfig?: EntityDefinition
): {
  [key: string]: unknown;
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction?: "asc" | "desc" };
  search?: string;
  searchFields?: string[];
  searchMode?: "contains" | "starts" | "ends" | "exact";
} {
  const options: {
    [key: string]: unknown;
    limit?: number;
    offset?: number;
    orderBy?: { field: string; direction?: "asc" | "desc" };
  } = {};

  // Extract pagination - support multiple types
  // Try to detect pagination type from query params
  const detectedPagination = detectPaginationFromQuery(query);
  
  if (detectedPagination) {
    options.limit = detectedPagination.limit;
    options.offset = detectedPagination.offset;
    
    // For cursor pagination, we'd need repository support
    // For now, we'll use offset-based approach
    // The cursor value could be used for filtering if repository supports it
  } else {
    // Fallback to legacy limit/offset if no pagination type detected
    if (query.limit !== undefined) {
      options.limit = typeof query.limit === "number" ? query.limit : Number(query.limit);
    }
    if (query.offset !== undefined) {
      options.offset = typeof query.offset === "number" ? query.offset : Number(query.offset);
    }
  }

  // Extract orderBy
  if (query.orderBy) {
    const orderByStr = String(query.orderBy);
    if (orderByStr.includes(":")) {
      // Format: orderBy=field:direction
      const [field, direction] = orderByStr.split(":");
      options.orderBy = {
        field: field.trim(),
        direction: (direction?.trim().toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc",
      };
    } else {
      // Format: orderBy=field (use orderDirection if provided)
      const direction = query.orderDirection 
        ? (String(query.orderDirection).toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc"
        : undefined;
      options.orderBy = {
        field: orderByStr,
        ...(direction && { direction }),
      };
    }
  }

  // Handle search parameter if present (auto-enabled if entity has searchable fields)
  if (query.search !== undefined) {
    // Check if search should be enabled
    const crudConfig = entityConfig?.crud;
    let searchEnabled = false;
    let searchConfig: CrudConfig["search"] | undefined;

    if (crudConfig) {
      if (typeof crudConfig === "object") {
        searchConfig = crudConfig.search;
        // Explicitly disabled
        if (searchConfig === false) {
          searchEnabled = false;
        } else {
          // Enabled if config exists or entity has searchable fields
          searchEnabled = true;
        }
      } else {
        // CRUD is boolean - check if entity has searchable fields
        const hasSearchableFields = Object.values(entityDef.fields).some(
          field => field.api !== false && (field.type === "string" || field.type === "text")
        );
        searchEnabled = hasSearchableFields;
      }
    } else {
      // No CRUD config - check if entity has searchable fields (auto-enable)
      const hasSearchableFields = Object.values(entityDef.fields).some(
        field => field.api !== false && (field.type === "string" || field.type === "text")
      );
      searchEnabled = hasSearchableFields;
    }

    if (searchEnabled) {
      options.search = String(query.search);
      
      // Get search mode
      if (searchConfig && typeof searchConfig === "object" && searchConfig.mode) {
        options.searchMode = searchConfig.mode;
      } else {
        options.searchMode = "contains"; // Default
      }

      // Determine searchable fields
      if (searchConfig === true) {
        // Use all searchable fields
        const searchable: string[] = [];
        for (const [fieldName, field] of Object.entries(entityDef.fields)) {
          if (field.api !== false && (field.type === "string" || field.type === "text")) {
            const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
            searchable.push(apiFieldName);
          }
        }
        options.searchFields = searchable;
      } else if (Array.isArray(searchConfig)) {
        // Specific fields
        options.searchFields = searchConfig;
      } else if (searchConfig && typeof searchConfig === "object" && searchConfig.fields) {
        if (Array.isArray(searchConfig.fields)) {
          options.searchFields = searchConfig.fields;
        } else if (searchConfig.fields === true) {
          // All searchable fields
          const searchable: string[] = [];
          for (const [fieldName, field] of Object.entries(entityDef.fields)) {
            if (field.api !== false && (field.type === "string" || field.type === "text")) {
              const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
              searchable.push(apiFieldName);
            }
          }
          options.searchFields = searchable;
        }
      } else {
        // Default: all string/text fields (auto-detected)
        const searchable: string[] = [];
        for (const [fieldName, field] of Object.entries(entityDef.fields)) {
          if (field.api !== false && (field.type === "string" || field.type === "text")) {
            const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
            searchable.push(apiFieldName);
          }
        }
        options.searchFields = searchable;
      }
    }
  }

  // Map query parameters to entity field filters
  // Match query param names to API field names
  for (const [queryKey, queryValue] of Object.entries(query)) {
    // Skip special query params
    if (["limit", "offset", "page", "pageSize", "cursor", "orderBy", "orderDirection", "search"].includes(queryKey)) {
      continue;
    }

    // Find matching entity field by API field name
    for (const [fieldName, field] of Object.entries(entityDef.fields)) {
      const apiFieldName = getApiFieldNameFromEntity(fieldName, field);
      if (apiFieldName === queryKey) {
        options[apiFieldName] = queryValue;
        break;
      }
    }
  }

  return options;
}

/**
 * Resolve parameter reference (e.g., "query.limit" or "params.id")
 * Returns the value from context or undefined if not found
 */
function resolveParameter(
  paramRef: string,
  context: HandlerContext
): unknown {
  if (typeof paramRef !== "string") {
    return paramRef; // Already a direct value
  }

  const parts = paramRef.split(".");
  if (parts.length !== 2) {
    return undefined;
  }

  const [source, key] = parts;
  if (source === "query") {
    return context.query[key];
  } else if (source === "params") {
    return context.params[key];
  }

  return undefined;
}

/**
 * Create a query handler from endpoint configuration
 */
function createQueryHandler(
  endpoint: NonNullable<YamaConfig["endpoints"]>[number],
  config?: YamaConfig,
  entities?: YamaEntities
): HandlerFunction {
  return async (context: HandlerContext) => {
    // Handler config must be an object with type: "query"
    if (typeof endpoint.handler !== "object" || endpoint.handler.type !== "query") {
      throw new Error("Invalid query handler configuration");
    }

    const handlerConfig = endpoint.handler;
    const entityName = handlerConfig.entity;

    // Check if entity exists
    if (!entities || !entities[entityName]) {
      throw new Error(`Entity "${entityName}" not found in configuration`);
    }

    // Check if repository is available
    if (!context.entities || !context.entities[entityName]) {
      throw new Error(`Repository for entity "${entityName}" not available in handler context`);
    }

    const repository = context.entities[entityName] as any;
    const entityDef = entities[entityName];

    // Build findAll options
    const options: Record<string, unknown> = {};

    // Process filters
    if (handlerConfig.filters && Array.isArray(handlerConfig.filters)) {
      const searchFields: string[] = [];
      let searchValue: string | undefined;

      for (const filter of handlerConfig.filters) {
        const paramValue = resolveParameter(filter.param, context);
        
        // Skip if parameter value is undefined or null
        if (paramValue === undefined || paramValue === null) {
          continue;
        }

        const apiFieldName = getApiFieldNameFromEntity(
          filter.field,
          entityDef.fields[filter.field] || {}
        );

        if (filter.operator === "eq") {
          // Exact match - use direct field matching
          options[apiFieldName] = paramValue;
        } else if (filter.operator === "ilike") {
          // Case-insensitive contains - use search functionality
          // Collect search fields and use the first value as search term
          if (!searchValue) {
            searchValue = String(paramValue);
          }
          searchFields.push(apiFieldName);
        } else {
          // For other operators (gt, gte, lt, lte), we'd need repository extension
          // For MVP, log a warning and skip
          console.warn(
            `⚠️  Operator "${filter.operator}" not fully supported for field "${filter.field}" in query handler. Only "eq" and "ilike" are supported.`
          );
        }
      }

      // Apply search if we have search fields
      if (searchValue && searchFields.length > 0) {
        options.search = searchValue;
        options.searchFields = searchFields;
        options.searchMode = "contains";
      }
    }

    // Process pagination using new pagination utilities
    let paginationMetadata: ReturnType<typeof calculatePaginationMetadata> | undefined;
    if (handlerConfig.pagination) {
      // Get primary key field for cursor pagination
      const primaryKeyField = getPrimaryKeyFieldName(entityDef);
      
      // Normalize pagination config
      const normalizedPagination = normalizePaginationConfig(
        handlerConfig.pagination,
        context,
        primaryKeyField,
        20 // default limit
      );

      if (normalizedPagination) {
        // Apply limit and offset to repository options
        options.limit = normalizedPagination.limit;
        options.offset = normalizedPagination.offset;

        // For cursor pagination, we need to handle it specially
        // Since repositories currently only support offset/limit, we'll convert cursor to offset
        // In a full implementation, repositories would support cursor-based queries natively
        if (normalizedPagination.type === "cursor" && normalizedPagination.cursorValue !== undefined) {
          // Note: Full cursor support would require repository-level changes
          // For now, we'll use offset-based pagination and let the repository handle it
          // The cursor value can be used for filtering if the repository supports it
          // This is a limitation - true cursor pagination needs repository support
        }
      }
    }

    // Process orderBy
    if (handlerConfig.orderBy) {
      if (typeof handlerConfig.orderBy === "string") {
        // Reference to query parameter
        const orderByValue = resolveParameter(handlerConfig.orderBy, context);
        if (orderByValue) {
          const orderByStr = String(orderByValue);
          if (orderByStr.includes(":")) {
            // Format: field:direction
            const [field, direction] = orderByStr.split(":");
            options.orderBy = {
              field: field.trim(),
              direction: (direction?.trim().toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc",
            };
          } else {
            // Just field name
            options.orderBy = {
              field: orderByStr,
            };
          }
        }
      } else {
        // Direct object configuration
        options.orderBy = {
          field: handlerConfig.orderBy.field,
          direction: handlerConfig.orderBy.direction || "asc",
        };
      }
    }

    // Call repository.findAll with built options
    const results = await repository.findAll(options);

    // Handle pagination metadata wrapping (always wrap when pagination is enabled)
    if (handlerConfig.pagination) {
      const primaryKeyField = getPrimaryKeyFieldName(entityDef);
      const normalizedPagination = normalizePaginationConfig(
        handlerConfig.pagination,
        context,
        primaryKeyField,
        20
      );

      if (normalizedPagination) {
        // Always calculate and wrap metadata when pagination is enabled
        paginationMetadata = calculatePaginationMetadata(
          normalizedPagination,
          results as unknown[],
          undefined // total count - would require a separate COUNT query
        );

        return wrapPaginatedResponse(
          results as unknown[],
          paginationMetadata,
          normalizedPagination.metadata
        );
      }
    }

    return results;
  };
}

function createDefaultHandler(
  endpoint: NonNullable<YamaConfig["endpoints"]>[number],
  responseType?: string,
  config?: YamaConfig,
  entities?: YamaEntities
): HandlerFunction {
  return async (context: HandlerContext) => {
    // If no response type, return placeholder message
    if (!responseType) {
      return {
        message: `Endpoint ${endpoint.method} ${endpoint.path} is configured but no handler is implemented`,
        path: endpoint.path,
        method: endpoint.method,
      };
    }

    // Try to detect entity from response type
    if (entities && config) {
      const entityName = extractEntityNameFromResponseType(responseType, entities);
      
      if (entityName && context.entities && context.entities[entityName]) {
        const repository = context.entities[entityName] as any;
        const entityDef = entities[entityName];
        const method = endpoint.method.toUpperCase();

        try {
          // GET /path (list) - expects EntityArray response
          if (method === "GET" && responseType.endsWith("Array")) {
            const options = mapQueryToFindAllOptions(context.query, entityDef, entities?.[entityName]);
            const results = await repository.findAll(options);
            
            // Detect pagination and wrap with metadata if present
            const detectedPagination = detectPaginationFromQuery(context.query);
            if (detectedPagination) {
              const metadata = calculatePaginationMetadata(
                detectedPagination,
                results as unknown[],
                undefined // total count - would require a separate COUNT query
              );
              // Always wrap with metadata (better DX)
              return wrapPaginatedResponse(results as unknown[], metadata);
            }
            
            return results;
          }

          // GET /path/:id (single) - expects Entity response
          if (method === "GET" && !responseType.endsWith("Array")) {
            // Extract primary key from params
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new Error(`Missing required parameter: ${primaryKey}`);
            }

            const result = await repository.findById(String(id));
            if (!result) {
              context.status(404);
              return { error: "Not found" };
            }
            return result;
          }

          // POST /path - create entity
          if (method === "POST") {
            if (!context.body) {
              throw new Error("Request body is required");
            }
            const result = await repository.create(context.body);
            context.status(201);
            return result;
          }

          // PUT /path/:id - full update
          if (method === "PUT") {
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new Error(`Missing required parameter: ${primaryKey}`);
            }
            if (!context.body) {
              throw new Error("Request body is required");
            }

            const result = await repository.update(String(id), context.body);
            if (!result) {
              context.status(404);
              return { error: "Not found" };
            }
            return result;
          }

          // PATCH /path/:id - partial update
          if (method === "PATCH") {
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new Error(`Missing required parameter: ${primaryKey}`);
            }
            if (!context.body) {
              throw new Error("Request body is required");
            }

            const result = await repository.update(String(id), context.body);
            if (!result) {
              context.status(404);
              return { error: "Not found" };
            }
            return result;
          }

          // DELETE /path/:id
          if (method === "DELETE") {
            const primaryKey = getPrimaryKeyFieldName(entityDef);
            const id = context.params[primaryKey] || context.params.id;
            
            if (!id) {
              throw new Error(`Missing required parameter: ${primaryKey}`);
            }

            const deleted = await repository.delete(String(id));
            if (!deleted) {
              context.status(404);
              return { error: "Not found" };
            }
            context.status(204);
            return undefined;
          }
        } catch (error) {
          // If repository method fails, re-throw to be caught by error handler
          throw error;
        }
      }
    }

    // Fallback: return empty object if response type is specified but entity not found
    // This allows validation to pass but indicates the endpoint needs a handler
    return {};
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

  // Case 2: Explicitly requires auth (required === true, roles, permissions, or handler specified)
  if (
    endpointAuth?.required === true ||
    (endpointAuth?.roles && endpointAuth.roles.length > 0) ||
    (endpointAuth?.permissions && endpointAuth.permissions.length > 0) ||
    endpointAuth?.handler
  ) {
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
  dbAdapter?: unknown,
  cacheAdapter?: unknown,
  storage?: Record<string, StorageBucket>,
  realtimeAdapter?: unknown
) {
  if (!config.endpoints) {
    return;
  }

  // Cache for endpoint-specific rate limiters (keyed by config hash)
  const endpointRateLimiters = new Map<string, RateLimiter>();

  for (const endpoint of config.endpoints) {
    const { path, method, handler: handlerConfig, description, params, body, query, response } = endpoint;
    
    // Use custom handler if provided, otherwise use default handler
    let handlerFn: HandlerFunction;
    let handlerLabel: string;
    
    // Check if handler is a query handler (object with type: "query")
    if (handlerConfig && typeof handlerConfig === "object" && handlerConfig.type === "query") {
      handlerFn = createQueryHandler(endpoint, config, config.entities);
      handlerLabel = "query";
    } else if (typeof handlerConfig === "string") {
      // Handler is a string - try to load from file
      const handlerName = handlerConfig;
      handlerFn = handlers[handlerName];
      if (!handlerFn) {
        console.warn(
          `⚠️  Handler "${handlerName}" not found for ${method} ${path}, using default handler`
        );
        handlerFn = createDefaultHandler(endpoint, response?.type, config, config.entities);
        handlerLabel = "default";
      } else {
        handlerLabel = handlerName;
      }
    } else {
      // No handler specified - use default handler
      handlerFn = createDefaultHandler(endpoint, response?.type, config, config.entities);
      handlerLabel = "default";
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
        let authContext: AuthContext | undefined;
        
        if (requiresAuth) {
          // --- SECURED ENDPOINT ---
          // Load custom auth handler if specified
          // Note: Custom auth handlers receive authContext and should return boolean
          // For complex cases requiring request data, handlers can access it via closure
          let authHandler: ((authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean) | undefined;
          if (endpoint.auth?.handler) {
            const handlerName = endpoint.auth.handler;
            const loadedHandler = handlers[handlerName];
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
                `⚠️  Auth handler "${handlerName}" not found for ${method} ${path}, authorization will fail`
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
              endpointRateLimiters.set(configKey, await createRateLimiterFromConfig(endpoint.rateLimit as any, cacheAdapter as any));
            }
            rateLimiter = endpointRateLimiters.get(configKey)!;
          }
          
          // If still no rate limiter, create one from global config and cache it (shouldn't happen if globalRateLimiter initialized correctly)
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
        const context = createHandlerContext(request, reply, authContext, repositories, dbAdapter, cacheAdapter, storage, realtimeAdapter);

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
            const currentHandlerLabel = typeof handlerConfig === "object" && handlerConfig.type === "query" 
              ? "query" 
              : (typeof handlerConfig === "string" ? handlerConfig : "default");
            console.error(`❌ Response validation failed for ${currentHandlerLabel}:`, responseValidation.errors);
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
        const currentHandlerLabel = typeof handlerConfig === "object" && handlerConfig.type === "query" 
          ? "query" 
          : (typeof handlerConfig === "string" ? handlerConfig : "default");
        console.error(`Error in handler ${currentHandlerLabel}:`, error);
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    };

    // Register route using adapter
    serverAdapter.registerRoute(server, method, path, wrappedHandler);

    // Log route registration with clear auth status
    const currentHandlerLabel = typeof handlerConfig === "object" && handlerConfig.type === "query" 
      ? "query" 
      : (typeof handlerConfig === "string" ? handlerConfig : "default");
    const authStatus = requiresAuth 
      ? ` [SECURED${endpoint.auth?.roles ? `, roles: ${endpoint.auth.roles.join(", ")}` : ""}]`
      : " [PUBLIC]";
    
    console.log(
      `✅ Registered route: ${method.toUpperCase()} ${path} -> ${currentHandlerLabel}${authStatus}${description ? ` (${description})` : ""}${params ? ` [validates path params]` : ""}${query ? ` [validates query params]` : ""}${body?.type ? ` [validates body: ${body.type}]` : ""}${response?.type ? ` [validates response: ${response.type}]` : ""}`
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

  // Storage buckets (initialized from storage plugins)
  const storageBuckets: Record<string, StorageBucket> = {};

  // Realtime adapter (initialized from realtime plugin if available)
  let realtimeAdapter: unknown = null;
  let realtimePluginApi: any = null;

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
      globalRateLimiter = await createRateLimiterFromConfig(config.rateLimit as any, cacheAdapter as any);
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

  // Setup realtime WebSocket server if plugin is loaded
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

  // Register OAuth endpoints if auto-generation is enabled
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

  // Load handlers and register routes
  if (config?.endpoints && handlersDir && serverAdapter && configDir) {
    const handlers = await loadHandlers(handlersDir, configDir);
    registerRoutes(serverAdapter, server, config, handlers, validator, globalRateLimiter, repositories, dbAdapter || null, cacheAdapter || null, storageBuckets, realtimeAdapter || null);
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

