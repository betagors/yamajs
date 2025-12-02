/**
 * Documentation Generator for Yama
 * Generates OpenAPI 3.0 specifications and other documentation formats from yama.yaml
 */

import { schemaToJsonSchema, type YamaSchemas, type SchemaDefinition, type YamaEntities, type DatabaseConfig, entitiesToSchemas, mergeSchemas, normalizeApisConfig, normalizeBodyDefinition, normalizeQueryOrParams, generateCrudInputSchemas, generateArraySchema, generateAllCrudEndpoints, entityToSchema, normalizeEntityDefinition } from "@betagors/yama-core";

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
  operations?: any; // YamaOperations
  policies?: any; // YamaPolicies
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
 * Generate input schema name (e.g., "CreatePostInput", "UpdatePostInput")
 */
function generateInputSchemaName(entityName: string, operation: "Create" | "Update"): string {
  return `${operation}${entityName}Input`;
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
    console.log(`  [endpointToOpenAPIOperation] Processing body for ${endpoint.method} ${endpoint.path}: ${JSON.stringify(endpoint.body)}`);
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
          console.log(`  [endpointToOpenAPIOperation] Found schema "${bodyType}" in available schemas`);
          schema = { $ref: `#/components/schemas/${bodyType}` };
        } else {
          // Fallback to basic type - log warning if schema not found
          console.warn(`⚠️  Warning: Body schema "${bodyType}" not found in available schemas. Available schemas: ${Object.keys(schemas || {}).slice(0, 10).join(', ')}${Object.keys(schemas || {}).length > 10 ? '...' : ''}`);
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
    console.log(`  [endpointToOpenAPIOperation] Added requestBody with schema: ${JSON.stringify(schema)}`);
  } else {
    console.log(`  [endpointToOpenAPIOperation] No body found for ${endpoint.method} ${endpoint.path}`);
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
  
  // Generate CRUD input schemas (CreateXInput, UpdateXInput) and array schemas for entities with CRUD enabled
  // Also check schemas with database properties (they should be treated as entities)
  const crudInputSchemas: YamaSchemas = {};
  const crudArraySchemas: YamaSchemas = {};
  
  // Combine entities and schemas with database properties
  const allEntities: YamaEntities = config.entities ? { ...config.entities } : {};
  if (config.schemas) {
    for (const [schemaName, schemaDef] of Object.entries(config.schemas)) {
      // Treat schemas with database properties as entities
      if (schemaDef && typeof schemaDef === 'object' && (schemaDef.database || (schemaDef as any).table)) {
        allEntities[schemaName] = schemaDef as any;
      }
    }
  }
  
  if (Object.keys(allEntities).length > 0) {
    for (const [entityName, entityDef] of Object.entries(allEntities)) {
      // Generate input schemas for all entities/schemas with database properties
      // (not just those with crud enabled, since operations might use them)
      const inputSchemas = generateCrudInputSchemas(entityName, entityDef);
      const arraySchemas = generateArraySchema(entityName, entityDef);
      Object.assign(crudInputSchemas, inputSchemas);
      Object.assign(crudArraySchemas, arraySchemas);
      console.log(`  Generated input schemas for ${entityName}: ${Object.keys(inputSchemas).join(', ')}`);
    }
  }
  
  if (Object.keys(crudInputSchemas).length > 0) {
    console.log(`  Total CRUD input schemas generated: ${Object.keys(crudInputSchemas).join(', ')}`);
  }
  
  // Merge schemas in order: entity schemas -> CRUD input schemas -> CRUD array schemas -> explicit schemas
  const mergedWithInputs = mergeSchemas(crudInputSchemas, entitySchemas);
  const mergedWithArrays = mergeSchemas(crudArraySchemas, mergedWithInputs);
  let allSchemas = mergeSchemas(config.schemas, mergedWithArrays);
  
  console.log(`  Total schemas available: ${Object.keys(allSchemas).length} (including ${Object.keys(crudInputSchemas).length} CRUD input schemas)`);

  // Convert endpoints to OpenAPI paths
  console.log("🔍 Debug: Starting endpoint processing...");
  console.log(`  Config.apis exists: ${!!config.apis}`);
  console.log(`  Config.apis.rest exists: ${!!config.apis?.rest}`);
  if (config.apis?.rest) {
    console.log(`  Config.apis.rest type: ${Array.isArray(config.apis.rest) ? 'array' : typeof config.apis.rest}`);
    console.log(`  Config.apis.rest keys: ${Object.keys(config.apis.rest).join(', ')}`);
  }
  
  // Generate CRUD endpoints from entities (if they have crud enabled)
  let crudEndpoints: EndpointDefinition[] = [];
  if (config.entities) {
    console.log(`  Checking ${Object.keys(config.entities).length} entity/entities for CRUD generation...`);
    const generatedCrudEndpoints = generateAllCrudEndpoints(config.entities);
    console.log(`  generateAllCrudEndpoints returned ${generatedCrudEndpoints.length} endpoint(s)`);
    if (generatedCrudEndpoints.length > 0) {
      // Convert CrudEndpoint[] to EndpointDefinition[] format
      crudEndpoints = generatedCrudEndpoints.map(ep => {
        const converted = {
          path: ep.path,
          method: ep.method,
          description: ep.description,
          params: ep.params,
          query: ep.query,
          body: ep.body,
          response: ep.response,
          auth: ep.auth,
        };
        // Debug: log body for POST/PUT/PATCH endpoints
        if (['POST', 'PUT', 'PATCH'].includes(ep.method) && ep.body) {
          console.log(`  CRUD endpoint ${ep.method} ${ep.path}: body = ${JSON.stringify(ep.body)}`);
        }
        return converted;
      });
      console.log(`  Generated ${crudEndpoints.length} CRUD endpoint(s) from entities`);
    }
  }
  
  // Normalize APIs config - includes operations conversion to endpoints
  // Convert schemas to entities format for normalizer (they're compatible)
  const schemasAsEntities = config.schemas ? Object.fromEntries(
    Object.entries(config.schemas).map(([name, schema]) => [
      name,
      { ...schema, fields: schema.fields || {} }
    ])
  ) : undefined;
  
  const normalizedApis = normalizeApisConfig({ 
    apis: config.apis,
    operations: config.operations,
    policies: config.policies,
    schemas: (schemasAsEntities as any) || config.entities,
  });
  console.log(`  Normalized APIs: ${normalizedApis.rest.length} REST config(s) found`);
  
  const allEndpoints = [
    ...crudEndpoints,
    ...normalizedApis.rest.flatMap(restConfig => {
      const endpointCount = restConfig.endpoints?.length || 0;
      console.log(`    Config "${restConfig.name}": ${endpointCount} endpoint(s), basePath: ${restConfig.basePath || '(none)'}`);
      return restConfig.endpoints || [];
    })
  ];
  
  // Generate input schemas for create/update operations that don't have explicit bodies
  // but have response schemas that reference entities
  const operationInputSchemas: YamaSchemas = {};
  for (const endpoint of allEndpoints) {
    if ((endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH') && !endpoint.body) {
      // Check if response references a schema
      const responseType = typeof endpoint.response === 'string' 
        ? endpoint.response 
        : (endpoint.response && typeof endpoint.response === 'object' && 'type' in endpoint.response)
          ? endpoint.response.type
          : undefined;
      if (responseType && allSchemas[responseType]) {
        // Extract base schema name (remove array syntax)
        const baseSchemaName = responseType.replace(/\[\]$/, '');
        if (allSchemas[baseSchemaName]) {
          // Generate input schema name
          const inputSchemaName = endpoint.method === 'POST' 
            ? generateInputSchemaName(baseSchemaName, 'Create')
            : generateInputSchemaName(baseSchemaName, 'Update');
          
          // Check if CRUD input schema already exists (e.g., CreateAuthorInput from CRUD generation)
          if (allSchemas[inputSchemaName]) {
            // Use existing CRUD input schema
            (endpoint as any).body = { type: inputSchemaName };
            console.log(`  Using existing CRUD input schema: ${inputSchemaName} for ${endpoint.method} ${endpoint.path}`);
            continue;
          }
          
          // Only generate if it doesn't already exist
          if (!operationInputSchemas[inputSchemaName]) {
            // Get the entity/schema definition - check both schemas and entities
            let schemaDef = allSchemas[baseSchemaName];
            let entityDef: any = undefined;
            
            // Check entities first
            if (config.entities && config.entities[baseSchemaName]) {
              entityDef = config.entities[baseSchemaName];
              if (!schemaDef) {
                // Convert entity to schema to get proper API fields (relations -> foreign keys)
                schemaDef = entityToSchema(baseSchemaName, entityDef);
              }
            } else if (config.schemas && config.schemas[baseSchemaName]) {
              // Check if schema has database property (treat as entity)
              const schema = config.schemas[baseSchemaName];
              if (schema && typeof schema === 'object' && (schema.database || (schema as any).table)) {
                entityDef = schema as any;
                if (!schemaDef) {
                  schemaDef = entityToSchema(baseSchemaName, entityDef);
                }
              }
            }
            
            if (schemaDef && typeof schemaDef === 'object' && 'fields' in schemaDef) {
              // Generate input schema similar to CRUD - need to get normalized entity fields
              // to check for readonly, autoUpdate, etc.
              let normalizedFields: Record<string, any> | undefined;
              if (entityDef) {
                const normalized = normalizeEntityDefinition(baseSchemaName, entityDef, undefined);
                normalizedFields = normalized.fields;
              }
              
              const inputFields: Record<string, any> = {};
              for (const [fieldName, field] of Object.entries(schemaDef.fields)) {
                // For create: exclude primary key, generated fields, readonly, autoUpdate, and timestamp fields
                if (endpoint.method === 'POST') {
                  const fieldDef = field as any;
                  // Check normalized entity field for additional metadata
                  const normalizedField = normalizedFields?.[fieldName];
                  
                  if (fieldDef.primary || fieldDef.generated || normalizedField?.primary || normalizedField?.generated) {
                    continue;
                  }
                  // Skip readonly fields
                  if (normalizedField?.readonly) {
                    continue;
                  }
                  // Skip auto-updated fields
                  if (normalizedField?.autoUpdate) {
                    continue;
                  }
                  // Skip fields with default functions like now()
                  // Check both normalized field and schema field for default values
                  const defaultValue = normalizedField?.default || fieldDef.default;
                  if (defaultValue && typeof defaultValue === 'string' && 
                      (defaultValue === 'now()' || defaultValue === 'now' || 
                       defaultValue.includes('()') && (defaultValue.includes('now') || defaultValue.includes('uuid')))) {
                    continue;
                  }
                  // Skip common timestamp fields
                  const timestampFieldNames = ['createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at'];
                  const fieldType = normalizedField?.type || fieldDef.type;
                  if (timestampFieldNames.includes(fieldName) && (fieldType === 'timestamp' || fieldType === 'timestamptz' || fieldType === 'datetimelocal' || fieldType === 'datetime' || fieldType === 'string' && fieldDef.format === 'date-time')) {
                    continue;
                  }
                  if (fieldDef.api === false || normalizedField?.api === false) {
                    continue;
                  }
                  // Skip relation objects (they should be foreign keys already from entityToSchema)
                  if (fieldDef.$ref) {
                    continue; // Skip schema references (relations)
                  }
                  inputFields[fieldName] = { ...field };
                } else {
                  // For update: exclude primary key (in path), generated fields, readonly, autoUpdate, and timestamp fields
                  const fieldDef = field as any;
                  const normalizedField = normalizedFields?.[fieldName];
                  
                  if (fieldDef.primary || normalizedField?.primary) {
                    continue;
                  }
                  // Skip generated fields
                  if (normalizedField?.generated) {
                    continue;
                  }
                  // Skip readonly fields
                  if (normalizedField?.readonly) {
                    continue;
                  }
                  // Skip auto-updated fields
                  if (normalizedField?.autoUpdate) {
                    continue;
                  }
                  // Skip fields with default functions like now()
                  const defaultValue = normalizedField?.default || fieldDef.default;
                  if (defaultValue && typeof defaultValue === 'string' && 
                      (defaultValue === 'now()' || defaultValue === 'now' || 
                       defaultValue.includes('()') && (defaultValue.includes('now') || defaultValue.includes('uuid')))) {
                    continue;
                  }
                  // Skip common timestamp fields
                  const timestampFieldNames = ['createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at'];
                  const fieldType = normalizedField?.type || fieldDef.type;
                  if (timestampFieldNames.includes(fieldName) && (fieldType === 'timestamp' || fieldType === 'timestamptz' || fieldType === 'datetimelocal' || fieldType === 'datetime' || fieldType === 'string' && fieldDef.format === 'date-time')) {
                    continue;
                  }
                  // Skip id field (it's in the path)
                  if (fieldName === 'id') {
                    continue;
                  }
                  if (fieldDef.api === false || normalizedField?.api === false) {
                    continue;
                  }
                  // Skip relation objects
                  if (fieldDef.$ref) {
                    continue; // Skip schema references (relations)
                  }
                  inputFields[fieldName] = { ...field, required: false };
                }
              }
              
              operationInputSchemas[inputSchemaName] = { fields: inputFields };
              console.log(`  Generated operation input schema: ${inputSchemaName} for ${endpoint.method} ${endpoint.path}`);
              
              // Update endpoint to reference the input schema
              (endpoint as any).body = { type: inputSchemaName };
            }
          } else if (allSchemas[inputSchemaName] || operationInputSchemas[inputSchemaName]) {
            // Schema already exists, just reference it
            (endpoint as any).body = { type: inputSchemaName };
            console.log(`  Using existing input schema: ${inputSchemaName} for ${endpoint.method} ${endpoint.path}`);
          }
        }
      }
    }
  }
  
  // Merge operation input schemas into allSchemas BEFORE converting to OpenAPI schemas
  if (Object.keys(operationInputSchemas).length > 0) {
    Object.assign(allSchemas, operationInputSchemas);
    console.log(`  Added ${Object.keys(operationInputSchemas).length} operation input schema(s) to schemas collection`);
  }
  
  // Now convert all schemas (including operation input schemas) to OpenAPI schemas
  // This needs to happen after we've added operation input schemas
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
      // Debug: log body for POST/PUT/PATCH endpoints
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.body) {
        console.log(`  Processing endpoint ${endpoint.method} ${endpoint.path}: body = ${JSON.stringify(endpoint.body)}`);
      }
      
      // Convert path parameters to OpenAPI format (e.g., :id -> {id} or {id} -> {id})
      const openAPIPath = endpoint.path.replace(/:(\w+)/g, "{$1}");

      if (!spec.paths[openAPIPath]) {
        spec.paths[openAPIPath] = {};
      }

      const method = endpoint.method.toLowerCase();
      
      // Check if this endpoint already exists (might be duplicate from CRUD + explicit definition)
      if (spec.paths[openAPIPath][method]) {
        console.warn(`⚠️  Warning: Endpoint "${endpoint.method} ${endpoint.path}" already exists. ${endpoint.body ? 'Keeping existing (has body)' : 'Overwriting with new definition'}`);
        // If the existing one doesn't have a body but this one does, prefer the one with body
        if (!spec.paths[openAPIPath][method].requestBody && endpoint.body) {
          console.log(`  Replacing endpoint with one that has body`);
        } else if (spec.paths[openAPIPath][method].requestBody && !endpoint.body) {
          console.log(`  Keeping existing endpoint (it has body, new one doesn't)`);
          continue; // Skip this endpoint, keep the existing one with body
        }
      }
      
      const operation = endpointToOpenAPIOperation(endpoint as EndpointDefinition, allSchemas, config.auth);
      
      // Validate operation has required fields
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        console.warn(`⚠️  Warning: Endpoint "${endpoint.method} ${endpoint.path}" has no responses, adding default 200 response`);
        operation.responses = {
          "200": { description: "Success" }
        };
      }
      
      spec.paths[openAPIPath][method] = operation;
      const hasRequestBody = !!operation.requestBody;
      const bodyInfo = hasRequestBody 
        ? `with requestBody (${JSON.stringify((operation.requestBody as any)?.content?.['application/json']?.schema || {})})` 
        : 'WITHOUT requestBody';
      console.log(`  ✓ Added ${method.toUpperCase()} ${openAPIPath} (operationId: ${operation.operationId || 'none'}) ${bodyInfo}`);
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

