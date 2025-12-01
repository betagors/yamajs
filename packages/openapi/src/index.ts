/**
 * Documentation Generator for Yama
 * Generates OpenAPI 3.0 specifications and other documentation formats from yama.yaml
 */

import { schemaToJsonSchema, type YamaSchemas, type SchemaDefinition, type YamaEntities, type DatabaseConfig, entitiesToSchemas, mergeSchemas, normalizeApisConfig, normalizeBodyDefinition, normalizeQueryOrParams } from "@betagors/yama-core";

export interface EndpointDefinition {
  path: string;
  method: string;
  handler?: string | object; // Optional - endpoints can work without handlers
  description?: string;
  query?: Record<string, any>;
  params?: Record<string, any>;
  body?: string | {
    type?: string;
    fields?: Record<string, any>;
  };
  response?: string | {
    type?: string;
    properties?: Record<string, any>;
  };
  auth?: {
    required?: boolean;
    roles?: string[];
  };
}

export interface YamaConfig {
  name?: string;
  version?: string;
  schemas?: YamaSchemas;
  entities?: YamaEntities;
  database?: DatabaseConfig;
  auth?: {
    providers?: Array<{
      type: "jwt" | "api-key";
      secret?: string;
      header?: string;
    }>;
  };
  apis?: {
    rest?: any;
  };
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, {
    [method: string]: {
      operationId?: string;
      summary?: string;
      description?: string;
      parameters?: Array<{
        name: string;
        in: "query" | "path" | "header" | "cookie";
        required?: boolean;
        schema: Record<string, unknown>;
        description?: string;
      }>;
      requestBody?: {
        content: {
          "application/json": {
            schema: Record<string, unknown>;
          };
        };
      };
      responses: Record<string, {
        description: string;
        content?: {
          "application/json": {
            schema: Record<string, unknown>;
          };
        };
      }>;
      security?: Array<Record<string, string[]>>;
    };
  }>;
  components: {
    schemas: Record<string, Record<string, unknown>>;
    securitySchemes?: Record<string, {
      type: string;
      scheme?: string;
      bearerFormat?: string;
      name?: string;
      in?: string;
    }>;
  };
  security?: Array<Record<string, string[]>>;
}

/**
 * Convert Yama type to OpenAPI type
 */
function yamaTypeToOpenAPIType(type?: string): string {
  switch (type) {
    case "integer":
      return "integer";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    case "string":
    default:
      return "string";
  }
}

/**
 * Convert Yama query/param field to OpenAPI parameter schema
 */
function fieldToOpenAPISchema(field: {
  type?: string;
  min?: number;
  max?: number;
  format?: string;
  enum?: unknown[];
}): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: yamaTypeToOpenAPIType(field.type)
  };

  if (field.format) {
    schema.format = field.format;
  }

  if (field.enum) {
    schema.enum = field.enum;
  }

  if (field.min !== undefined) {
    schema.minimum = field.min;
  }

  if (field.max !== undefined) {
    schema.maximum = field.max;
  }

  return schema;
}

/**
 * Convert endpoint path parameters to OpenAPI path parameters
 * Handles both :id (Yama format) and {id} (OpenAPI format)
 */
function extractPathParams(path: string): string[] {
  // Try Yama format first (:id)
  const yamaMatches = path.matchAll(/:(\w+)/g);
  const yamaParams = Array.from(yamaMatches, m => m[1]);
  if (yamaParams.length > 0) {
    return yamaParams;
  }
  // Try OpenAPI format ({id})
  const openAPIMatches = path.matchAll(/\{(\w+)\}/g);
  return Array.from(openAPIMatches, m => m[1]);
}

/**
 * Convert endpoint to OpenAPI path operation
 */
function endpointToOpenAPIOperation(
  endpoint: EndpointDefinition,
  schemas?: YamaSchemas,
  authConfig?: YamaConfig["auth"]
): OpenAPISpec["paths"][string][string] {
  // Generate operationId from path and method
  const operationId = `${endpoint.method.toLowerCase()}_${endpoint.path
    .replace(/[{}:]/g, '')
    .replace(/\//g, '_')
    .replace(/^_|_$/g, '')}`;
  
  const operation: OpenAPISpec["paths"][string][string] = {
    operationId,
    responses: {}
  } as OpenAPISpec["paths"][string][string];

  if (endpoint.description) {
    operation.summary = endpoint.description;
    operation.description = endpoint.description;
  } else {
    // Generate a default summary if none provided
    const method = endpoint.method.toUpperCase();
    const pathParts = endpoint.path.split('/').filter(p => p);
    const resource = pathParts[0] || 'resource';
    operation.summary = `${method} ${endpoint.path}`;
  }

  // Parameters (path + query)
  const parameters: Array<{
    name: string;
    in: "query" | "path" | "header" | "cookie";
    required?: boolean;
    schema: Record<string, unknown>;
    description?: string;
  }> = [];

  // Path parameters
  const pathParams = extractPathParams(endpoint.path);
  if (pathParams.length > 0 && endpoint.params) {
    for (const paramName of pathParams) {
      const paramDef = endpoint.params[paramName];
      if (paramDef) {
        parameters.push({
          name: paramName,
          in: "path" as const,
          required: paramDef.required !== false,
          schema: fieldToOpenAPISchema(paramDef),
          description: `Path parameter: ${paramName}`
        });
      }
    }
  }

  // Query parameters
  if (endpoint.query) {
    for (const [paramName, paramDef] of Object.entries(endpoint.query)) {
      parameters.push({
        name: paramName,
        in: "query" as const,
        required: paramDef.required === true,
        schema: fieldToOpenAPISchema(paramDef),
        description: `Query parameter: ${paramName}`
      });
    }
  }

  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  // Request body
  if (endpoint.body) {
    let schema: Record<string, unknown>;

    // Handle inline fields definition
    if (typeof endpoint.body === "object" && endpoint.body.fields) {
      // Normalize the body fields and convert to JSON Schema
      const normalizedBody = normalizeBodyDefinition(endpoint.body);
      if (normalizedBody?.fields) {
        // Convert fields to a schema definition and then to JSON Schema
        const tempSchemaDef: SchemaDefinition = {
          fields: normalizedBody.fields
        };
        schema = schemaToJsonSchema("_inline", tempSchemaDef, schemas);
      } else {
        schema = { type: "object" };
      }
    } else {
      // Handle type reference (string or object with type)
      const bodyType = typeof endpoint.body === "string" ? endpoint.body : endpoint.body?.type;
      if (bodyType) {
        // Handle array syntax like "Post[]"
        const arrayMatch = bodyType.match(/^(.+)\[\]$/);
        if (arrayMatch) {
          const baseType = arrayMatch[1];
          if (schemas && schemas[baseType]) {
            // Array of schema reference
            schema = {
              type: "array",
              items: { $ref: `#/components/schemas/${baseType}` }
            };
          } else {
            // Array of primitive type
            schema = {
              type: "array",
              items: { type: yamaTypeToOpenAPIType(baseType) }
            };
          }
        } else if (schemas && schemas[bodyType]) {
          // Reference to a schema
          schema = { $ref: `#/components/schemas/${bodyType}` };
        } else {
          // Fallback to basic type
          schema = { type: yamaTypeToOpenAPIType(bodyType) };
        }
      } else {
        // No body type specified
        schema = { type: "object" };
      }
    }

    operation.requestBody = {
      content: {
        "application/json": {
          schema
        }
      }
    };
  }

  // Responses
  const responses: Record<string, {
    description: string;
    content?: {
      "application/json": {
        schema: Record<string, unknown>;
      };
    };
  }> = {};

  const responseType = typeof endpoint.response === "string" ? endpoint.response : endpoint.response?.type;
  if (responseType) {
    let schema: Record<string, unknown>;

    // Handle array syntax like "PostWithAuthor[]"
    const arrayMatch = responseType.match(/^(.+)\[\]$/);
    if (arrayMatch) {
      const baseType = arrayMatch[1];
      if (schemas && schemas[baseType]) {
        // Array of schema reference
        schema = {
          type: "array",
          items: { $ref: `#/components/schemas/${baseType}` }
        };
      } else {
        // Array of primitive type
        schema = {
          type: "array",
          items: { type: yamaTypeToOpenAPIType(baseType) }
        };
      }
    } else if (schemas && schemas[responseType]) {
      // Reference to a schema
      schema = { $ref: `#/components/schemas/${responseType}` };
    } else {
      // Fallback to basic type
      schema = { type: yamaTypeToOpenAPIType(responseType) };
    }

    responses["200"] = {
      description: "Success",
      content: {
        "application/json": {
          schema
        }
      }
    };
  } else if (endpoint.method === "DELETE") {
    // DELETE without response type defaults to 204
    responses["204"] = {
      description: "No Content"
    };
  } else {
    // Default 200 response
    responses["200"] = {
      description: "Success"
    };
  }

  // Add error responses
  responses["400"] = {
    description: "Bad Request"
  };
  responses["500"] = {
    description: "Internal Server Error"
  };

  operation.responses = responses;

  // Add security requirements if auth is required
  if (endpoint.auth && endpoint.auth.required !== false && authConfig?.providers) {
    const security: Array<Record<string, string[]>> = [];
    
    for (const provider of authConfig.providers) {
      if (provider.type === "jwt") {
        security.push({ bearerAuth: [] });
      } else if (provider.type === "api-key") {
        const schemeName = provider.header?.toLowerCase().replace(/[^a-z0-9]/g, "") || "apikey";
        security.push({ [schemeName]: [] });
      }
    }
    
    if (security.length > 0) {
      operation.security = security;
    }
  }

  return operation;
}

/**
 * Generate OpenAPI 3.0 specification from Yama config
 */
export function generateOpenAPI(config: YamaConfig): OpenAPISpec {
  // Support both project.name/version and top-level name/version
  const projectName = (config as any).project?.name || config.name || "API";
  const projectVersion = (config as any).project?.version || config.version || "1.0.0";
  
  const spec: OpenAPISpec = {
    openapi: "3.0.0",
    info: {
      title: projectName,
      version: projectVersion
    },
    paths: {},
    components: {
      schemas: {}
    }
  };

  // Convert entities to schemas and merge with explicit schemas
  const entitySchemas = config.entities ? entitiesToSchemas(config.entities) : {};
  const allSchemas = mergeSchemas(config.schemas, entitySchemas);

  // Convert all schemas to OpenAPI schemas
  for (const [schemaName, schemaDef] of Object.entries(allSchemas)) {
    // Skip undefined or null schema definitions
    if (!schemaDef || typeof schemaDef !== 'object' || schemaDef === null) {
      console.warn(
        `Warning: Skipping schema "${schemaName}" - invalid schema definition (${typeof schemaDef})`
      );
      continue;
    }

    try {
      const schema = schemaToJsonSchema(schemaName, schemaDef, allSchemas);
      spec.components.schemas[schemaName] = schema;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error && error.stack ? `\n${error.stack}` : '';
      console.error(
        `Error: Failed to convert schema "${schemaName}" to OpenAPI schema.\n` +
        `  Reason: ${errorMessage}${errorDetails}\n` +
        `  This schema will be skipped in the OpenAPI specification.`
      );
    }
  }

  // Convert endpoints to OpenAPI paths
  console.log("🔍 Debug: Starting endpoint processing...");
  console.log(`  Config.apis exists: ${!!config.apis}`);
  console.log(`  Config.apis.rest exists: ${!!config.apis?.rest}`);
  if (config.apis?.rest) {
    console.log(`  Config.apis.rest type: ${Array.isArray(config.apis.rest) ? 'array' : typeof config.apis.rest}`);
    console.log(`  Config.apis.rest keys: ${Object.keys(config.apis.rest).join(', ')}`);
  }
  
  const normalizedApis = normalizeApisConfig({ apis: config.apis });
  console.log(`  Normalized APIs: ${normalizedApis.rest.length} REST config(s) found`);
  
  const allEndpoints = normalizedApis.rest.flatMap(restConfig => {
    const endpointCount = restConfig.endpoints?.length || 0;
    console.log(`    Config "${restConfig.name}": ${endpointCount} endpoint(s), basePath: ${restConfig.basePath || '(none)'}`);
    return restConfig.endpoints || [];
  });
  
  if (allEndpoints.length === 0) {
    console.warn("Warning: No endpoints found in API configuration. OpenAPI spec will have no paths.");
    console.warn(`  Config.apis: ${JSON.stringify(config.apis, null, 2)}`);
    console.warn(`  Normalized APIs: ${JSON.stringify(normalizedApis, null, 2)}`);
  } else {
    console.log(`ℹ️  Found ${allEndpoints.length} endpoint(s) to document`);
  }
  
  for (const endpoint of allEndpoints) {
    if (!endpoint || !endpoint.path || !endpoint.method) {
      console.warn(`Warning: Skipping invalid endpoint: ${JSON.stringify(endpoint)}`);
      continue;
    }
    
    try {
      // Convert path parameters to OpenAPI format (e.g., :id -> {id} or {id} -> {id})
      const openAPIPath = endpoint.path.replace(/:(\w+)/g, "{$1}");

      if (!spec.paths[openAPIPath]) {
        spec.paths[openAPIPath] = {};
      }

      const method = endpoint.method.toLowerCase();
      const operation = endpointToOpenAPIOperation(endpoint as EndpointDefinition, allSchemas, config.auth);
      
      // Validate operation has required fields
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        console.warn(`⚠️  Warning: Endpoint "${endpoint.method} ${endpoint.path}" has no responses, adding default 200 response`);
        operation.responses = {
          "200": { description: "Success" }
        };
      }
      
      spec.paths[openAPIPath][method] = operation;
      console.log(`  ✓ Added ${method.toUpperCase()} ${openAPIPath} (operationId: ${operation.operationId || 'none'})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error && error.stack ? `\n  Stack: ${error.stack}` : '';
      console.error(
        `❌ Error: Failed to convert endpoint "${endpoint.method} ${endpoint.path}" to OpenAPI operation.\n` +
        `  Reason: ${errorMessage}${errorStack}\n` +
        `  This endpoint will be skipped in the OpenAPI specification.`
      );
    }
  }

  // Log summary
  const pathCount = Object.keys(spec.paths).length;
  if (pathCount > 0) {
    console.log(`✓ OpenAPI spec generated with ${pathCount} path(s) and ${Object.keys(spec.components.schemas).length} schema(s)`);
  } else {
    console.warn("⚠️  OpenAPI spec generated but no paths were added. Check endpoint configuration.");
  }

  // Add security schemes to components
  if (config.auth?.providers) {
    spec.components.securitySchemes = {};
    
    for (const provider of config.auth.providers) {
      if (provider.type === "jwt") {
        spec.components.securitySchemes.bearerAuth = {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        };
      } else if (provider.type === "api-key") {
        const schemeName = provider.header?.toLowerCase().replace(/[^a-z0-9]/g, "") || "apikey";
        spec.components.securitySchemes[schemeName] = {
          type: "apiKey",
          name: provider.header || "X-API-Key",
          in: "header"
        };
      }
    }
  }

  // Final validation - ensure paths object exists and has content
  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    console.warn("⚠️  WARNING: OpenAPI spec has no paths! This will result in 'No operations defined in spec!' in Swagger UI.");
    console.warn(`  Total endpoints processed: ${allEndpoints.length}`);
    console.warn(`  Total paths in spec: ${Object.keys(spec.paths || {}).length}`);
    if (allEndpoints.length > 0) {
      console.warn(`  This suggests endpoints are being processed but not added to spec.paths.`);
      console.warn(`  First endpoint example: ${JSON.stringify(allEndpoints[0], null, 2)}`);
    }
  }

  return spec;
}

