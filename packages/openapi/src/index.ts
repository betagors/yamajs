/**
 * Documentation Generator for Yama
 * Generates OpenAPI 3.0 specifications and other documentation formats from yama.yaml
 */

import { schemaToJsonSchema, type YamaSchemas, type SchemaDefinition, type YamaEntities, type DatabaseConfig, entitiesToSchemas, mergeSchemas } from "@betagors/yama-core";

export interface EndpointDefinition {
  path: string;
  method: string;
  handler?: string; // Optional - endpoints can work without handlers
  description?: string;
  query?: Record<string, {
    type?: string;
    required?: boolean;
    min?: number;
    max?: number;
    format?: string;
    enum?: unknown[];
  }>;
  params?: Record<string, {
    type?: string;
    required?: boolean;
  }>;
  body?: {
    type?: string;
  };
  response?: {
    type?: string;
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
  endpoints?: EndpointDefinition[];
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
 */
function extractPathParams(path: string): string[] {
  const matches = path.matchAll(/:(\w+)/g);
  return Array.from(matches, m => m[1]);
}

/**
 * Convert endpoint to OpenAPI path operation
 */
function endpointToOpenAPIOperation(
  endpoint: EndpointDefinition,
  schemas?: YamaSchemas,
  authConfig?: YamaConfig["auth"]
): OpenAPISpec["paths"][string][string] {
  const operation: OpenAPISpec["paths"][string][string] = {
    responses: {}
  } as OpenAPISpec["paths"][string][string];

  if (endpoint.description) {
    operation.summary = endpoint.description;
    operation.description = endpoint.description;
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
  if (endpoint.body?.type) {
    const bodyType = endpoint.body.type;
    let schema: Record<string, unknown>;

    if (schemas && schemas[bodyType]) {
      // Reference to a schema
      schema = { $ref: `#/components/schemas/${bodyType}` };
    } else {
      // Fallback to basic type
      schema = { type: yamaTypeToOpenAPIType(bodyType) };
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

  if (endpoint.response?.type) {
    const responseType = endpoint.response.type;
    let schema: Record<string, unknown>;

    if (schemas && schemas[responseType]) {
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
  const spec: OpenAPISpec = {
    openapi: "3.0.0",
    info: {
      title: config.name || "API",
      version: config.version || "1.0.0"
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
    try {
      const schema = schemaToJsonSchema(schemaName, schemaDef, allSchemas);
      spec.components.schemas[schemaName] = schema;
    } catch (error) {
      console.warn(`Warning: Failed to convert schema "${schemaName}" to OpenAPI schema:`, error);
    }
  }

  // Convert endpoints to OpenAPI paths
  if (config.endpoints) {
    for (const endpoint of config.endpoints) {
      // Convert path parameters to OpenAPI format (e.g., :id -> {id})
      const openAPIPath = endpoint.path.replace(/:(\w+)/g, "{$1}");

      if (!spec.paths[openAPIPath]) {
        spec.paths[openAPIPath] = {};
      }

      const method = endpoint.method.toLowerCase();
      spec.paths[openAPIPath][method] = endpointToOpenAPIOperation(endpoint, allSchemas, config.auth);
    }
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

  return spec;
}

