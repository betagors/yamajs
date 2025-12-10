import type { SchemaField, SchemaDefinition, YamaSchemas } from "./schemas.js";
import type { YamaEntities } from "./entities.js";
import { entitiesToSchemas, mergeSchemas } from "./entities.js";
import { normalizeQueryOrParams, normalizeBodyDefinition, parseSchemaFieldDefinition } from "./schemas.js";
import { normalizeApisConfig, type NormalizedEndpoint } from "./apis/index.js";
import type { YamaOperations } from "./operations/types.js";
import { parseOperations } from "./operations/index.js";

/**
 * Endpoint definition for handler context generation
 */
export interface EndpointDefinition {
  path: string;
  method: string;
  handler?: string;
  description?: string;
  params?: Record<string, SchemaField>;
  query?: Record<string, SchemaField>;
  body?: {
    type?: string;
  };
  response?: {
    type?: string;
    properties?: Record<string, SchemaField>;
    required?: string[];
  };
  auth?: {
    required?: boolean;
    roles?: string[];
  };
}

/**
 * Yama config for handler context generation
 */
export interface HandlerContextConfig {
  schemas?: YamaSchemas;
  entities?: YamaEntities;
  apis?: {
    rest?: any;
  };
  operations?: YamaOperations;
  policies?: import("./policies/types.js").YamaPolicies;
}

/**
 * Available services configuration for handler context generation
 */
export interface AvailableServices {
  db?: boolean; // Database adapter available
  entities?: boolean; // Entity repositories available
  cache?: boolean; // Cache adapter available
  storage?: boolean; // Storage buckets available
  realtime?: boolean; // Realtime adapter available
}

/**
 * Convert a Yama schema field to TypeScript type string
 */
function fieldToTypeScript(
  field: SchemaField | string,
  indent = 0,
  schemas?: YamaSchemas,
  visited: Set<string> = new Set()
): string {
  const spaces = "  ".repeat(indent);
  
  // Handle case where field is still a string (defensive check)
  let normalizedField: SchemaField;
  if (typeof field === "string") {
    // This shouldn't happen if normalization is working correctly, but handle it gracefully
    normalizedField = parseSchemaFieldDefinition("", field);
  } else {
    normalizedField = field;
  }
  
  // Handle legacy $ref (deprecated but still supported)
  if (normalizedField.$ref) {
    if (visited.has(normalizedField.$ref)) {
      throw new Error(`Circular reference detected in type generation: ${normalizedField.$ref}`);
    }
    
    if (!schemas || !schemas[normalizedField.$ref]) {
      throw new Error(`Schema reference "${normalizedField.$ref}" not found in type generation`);
    }
    
    // Return the referenced schema name directly
    return normalizedField.$ref;
  }
  
  // Type is required
  if (!normalizedField.type) {
    throw new Error(`Field must have a type. Field definition: ${JSON.stringify(normalizedField)}`);
  }
  
  const typeStr = String(normalizedField.type);
  
  // Define primitive types that should NOT be treated as schema references
  const primitiveTypes = ["uuid", "string", "number", "boolean", "integer", "array", "list", "object"];
  const isPrimitive = primitiveTypes.includes(typeStr);
  
  // Handle array syntax like "User[]" - this is the preferred way
  const arrayMatch = typeStr.match(/^(.+)\[\]$/);
  if (arrayMatch) {
    const baseType = arrayMatch[1];
    // Check if baseType is a primitive (shouldn't happen, but be safe)
    if (primitiveTypes.includes(baseType)) {
      // This is invalid - can't have "string[]" as a type, should use items instead
      throw new Error(`Invalid array type "${typeStr}". Use type: "array" with items instead.`);
    }
    
    if (!schemas || !schemas[baseType]) {
      throw new Error(`Schema reference "${baseType}" not found (in array type "${typeStr}")`);
    }
    
    if (visited.has(baseType)) {
      throw new Error(`Circular reference detected: ${baseType}`);
    }
    
    // Return TypeScript array type
    return `${baseType}[]`;
  }
  
  // Handle direct schema reference (e.g., type: "User")
  // Only if it's NOT a primitive type and it exists in schemas
  if (!isPrimitive && schemas && schemas[typeStr]) {
    if (visited.has(typeStr)) {
      throw new Error(`Circular reference detected: ${typeStr}`);
    }
    
    // Return the schema name directly
    return typeStr;
  }
  
  // Handle primitive types
  switch (typeStr) {
    case "uuid":
      // UUID is represented as string in TypeScript
      return "string";
    
    case "string":
      // Handle enum types
      if (normalizedField.enum && Array.isArray(normalizedField.enum)) {
        const enumValues = normalizedField.enum
          .map((val) => (typeof val === "string" ? `"${val}"` : String(val)))
          .join(" | ");
        return enumValues;
      }
      return "string";
    
    case "number":
    case "integer":
      // Handle enum types for numbers
      if (normalizedField.enum && Array.isArray(normalizedField.enum)) {
        const enumValues = normalizedField.enum.map((val) => String(val)).join(" | ");
        return enumValues;
      }
      return "number";
    
    case "boolean":
      // Handle enum types for booleans
      if (normalizedField.enum && Array.isArray(normalizedField.enum)) {
        const enumValues = normalizedField.enum.map((val) => String(val)).join(" | ");
        return enumValues;
      }
      return "boolean";
    
    case "array":
    case "list":
      if (normalizedField.items) {
        const itemType = fieldToTypeScript(normalizedField.items, indent, schemas, visited);
        return `${itemType}[]`;
      }
      return "unknown[]";
    
    case "object":
      if (normalizedField.properties && typeof normalizedField.properties === 'object' && normalizedField.properties !== null) {
        const props: string[] = [];
        for (const [propName, propField] of Object.entries(normalizedField.properties)) {
          const propType = fieldToTypeScript(propField, indent + 1, schemas, visited);
          // Handle case where propField might be a string
          const propFieldNormalized = typeof propField === "string" 
            ? parseSchemaFieldDefinition(propName, propField)
            : propField;
          const optional = propFieldNormalized.required ? "" : "?";
          props.push(`${spaces}  ${propName}${optional}: ${propType};`);
        }
        return `{\n${props.join("\n")}\n${spaces}}`;
      }
      return "Record<string, unknown>";
    
    default:
      // If it's not a primitive and not a schema reference, return as-is (might be a custom type)
      return typeStr;
  }
}

/**
 * Generate TypeScript type definition for a schema
 * Handles source inheritance, computed fields, and inline nested types
 */
function generateSchemaType(
  schemaName: string,
  schemaDef: SchemaDefinition,
  schemas?: YamaSchemas,
  entities?: YamaEntities,
  visited: Set<string> = new Set()
): string {
  if (visited.has(schemaName)) {
    throw new Error(`Circular reference detected in schema: ${schemaName}`);
  }
  visited.add(schemaName);
  
  const fields: string[] = [];
  
  // Handle source inheritance
  if ((schemaDef as any).source && schemas) {
    const sourceName = (schemaDef as any).source;
    const sourceSchema = schemas[sourceName];
    if (sourceSchema) {
      // Include fields from source
      const includeFields = (schemaDef as any).include;
      if (Array.isArray(includeFields)) {
        // Only include specified fields
        for (const fieldName of includeFields) {
          if (sourceSchema.fields[fieldName]) {
            const field = sourceSchema.fields[fieldName];
            const fieldType = fieldToTypeScript(field, 1, schemas, new Set(visited));
            const optional = field.required ? "" : "?";
            fields.push(`  ${fieldName}${optional}: ${fieldType};`);
          }
        }
      } else {
        // Include all fields from source
        for (const [fieldName, field] of Object.entries(sourceSchema.fields)) {
          const fieldType = fieldToTypeScript(field, 1, schemas, new Set(visited));
          const optional = field.required ? "" : "?";
          fields.push(`  ${fieldName}${optional}: ${fieldType};`);
        }
      }
    }
  }
  
  // Add fields from this schema (override source fields)
  if (schemaDef.fields && typeof schemaDef.fields === 'object') {
    for (const [fieldName, field] of Object.entries(schemaDef.fields)) {
      // Handle inline nested types
      if (typeof field === "object" && "properties" in field && field.properties) {
        // Inline nested type
        const nestedFields: string[] = [];
        for (const [propName, propField] of Object.entries(field.properties)) {
          const propType = fieldToTypeScript(propField, 2, schemas, new Set(visited));
          const propFieldNormalized = typeof propField === "string" 
            ? parseSchemaFieldDefinition(propName, propField)
            : propField;
          const optional = propFieldNormalized.required ? "" : "?";
          nestedFields.push(`    ${propName}${optional}: ${propType};`);
        }
        const fieldOptional = field.required ? "" : "?";
        fields.push(`  ${fieldName}${fieldOptional}: {\n${nestedFields.join("\n")}\n  };`);
      } else {
        const fieldType = fieldToTypeScript(field, 1, schemas, new Set(visited));
        const optional = field.required ? "" : "?";
        fields.push(`  ${fieldName}${optional}: ${fieldType};`);
      }
    }
  }
  
  // Add computed fields
  if (schemaDef.computed && typeof schemaDef.computed === 'object') {
    for (const [fieldName, computedDef] of Object.entries(schemaDef.computed)) {
      // Determine computed field type
      let computedType = "unknown";
      if (typeof computedDef === "object" && computedDef.type) {
        computedType = computedDef.type;
      } else {
        // Try to infer from expression
        const expr = typeof computedDef === "string" ? computedDef : computedDef.expression;
        if (expr.includes("count(") || expr.includes("sum(") || expr.includes("avg(")) {
          computedType = "number";
        } else if (expr.includes("{{") && expr.includes("}}")) {
          computedType = "string";
        }
      }
      fields.push(`  ${fieldName}: ${computedType};`);
    }
  }
  
  visited.delete(schemaName);
  
  return `export interface ${schemaName} {\n${fields.join("\n")}\n}`;
}

/**
 * Generate TypeScript types from Yama schemas and entities
 */
export function generateTypes(
  schemas?: YamaSchemas,
  entities?: YamaEntities
): string {
  const imports = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

`;

  // Convert entities to schemas and merge with explicit schemas
  const entitySchemas = entities ? entitiesToSchemas(entities) : {};
  // Ensure schemas is not null before merging
  const normalizedSchemas = schemas && typeof schemas === 'object' && schemas !== null ? schemas : undefined;
  const allSchemas = mergeSchemas(normalizedSchemas, entitySchemas) || {};

  // Ensure allSchemas is always an object before calling Object.entries
  if (!allSchemas || typeof allSchemas !== 'object' || allSchemas === null) {
    return imports + "// No schemas defined\n";
  }

  const typeDefinitions: string[] = [];
  
  for (const [schemaName, schemaDef] of Object.entries(allSchemas)) {
    typeDefinitions.push(generateSchemaType(schemaName, schemaDef, allSchemas, entities));
  }
  
  return imports + typeDefinitions.join("\n\n") + "\n";
}

/**
 * Convert handler path to TypeScript interface name
 * Extracts filename from path and converts to PascalCase
 */
function handlerNameToInterfaceName(handlerPath: string): string {
  // Extract filename from path (handle both / and \ separators)
  const fileName = handlerPath.split(/[/\\]/).pop() || handlerPath;
  // Remove extension
  const nameWithoutExt = fileName.replace(/\.(ts|js)$/, "");
  // Convert camelCase to PascalCase and add "HandlerContext" suffix
  const pascalCase = nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
  return `${pascalCase}HandlerContext`;
}

/**
 * Generate TypeScript type for params/query from endpoint definition
 */
function generateParamsOrQueryType(
  fields: Record<string, SchemaField> | undefined,
  schemas?: YamaSchemas,
  visited: Set<string> = new Set(),
  useTypesNamespace: boolean = false
): string {
  if (!fields || typeof fields !== 'object' || fields === null || Object.keys(fields).length === 0) {
    return "{}";
  }

  const props: string[] = [];
  for (const [fieldName, field] of Object.entries(fields)) {
    // Handle case where field is still a string (shouldn't happen, but be defensive)
    let normalizedField: SchemaField;
    if (typeof field === "string") {
      normalizedField = parseSchemaFieldDefinition(fieldName, field);
    } else if (field && typeof field === "object") {
      normalizedField = field;
    } else {
      throw new Error(`Field "${fieldName}" has invalid type. Expected string or SchemaField object, got ${typeof field}`);
    }
    
    if (!normalizedField.type) {
      throw new Error(`Field "${fieldName}" must have a type property. Field definition: ${JSON.stringify(normalizedField)}`);
    }
    let fieldType = fieldToTypeScript(normalizedField, 0, schemas, visited);
    
    // If using Types namespace and field is a schema reference (not a primitive), prefix with Types.
    // Check if the type is a schema reference by seeing if it exists in schemas
    if (useTypesNamespace && schemas && normalizedField.type) {
      const typeStr = String(normalizedField.type);
      const primitiveTypes = ["string", "number", "boolean", "integer", "array", "list", "object"];
      const isPrimitive = primitiveTypes.includes(typeStr);
      
      // Check for array syntax like "User[]"
      const arrayMatch = typeStr.match(/^(.+)\[\]$/);
      const baseType = arrayMatch ? arrayMatch[1] : typeStr;
      
      // If it's a schema reference (not a primitive and exists in schemas), prefix with Types.
      if ((!isPrimitive && schemas[typeStr]) || (arrayMatch && schemas[baseType])) {
        // For array types, wrap the base type: Types.User[]
        if (arrayMatch) {
          fieldType = `Types.${baseType}[]`;
        } else {
          fieldType = `Types.${fieldType}`;
        }
      }
    }
    
    const optional = normalizedField.required ? "" : "?";
    props.push(`  ${fieldName}${optional}: ${fieldType};`);
  }

  return `{\n${props.join("\n")}\n}`;
}

/**
 * Generate handler context types from Yama config
 */
export function generateHandlerContexts(
  config: HandlerContextConfig,
  typesImportPath: string = "../types",
  handlerContextImportPath: string = "@betagors/yama-core",
  repositoryTypesImportPath?: string,
  availableServices?: AvailableServices
): string {
  // Determine which services are available
  // Services are only available if both the plugin is configured AND the service is actually used
  const hasDb = availableServices?.db ?? false;
  const hasEntities = (availableServices?.entities ?? false) && (config.entities && typeof config.entities === 'object' && config.entities !== null && Object.keys(config.entities).length > 0);
  const hasCache = availableServices?.cache ?? false;
  const hasStorage = availableServices?.storage ?? false;
  const hasRealtime = availableServices?.realtime ?? false;

  // Generate entities type if entities exist
  let entitiesType = "Record<string, unknown>";
  let repositoryTypesImport = "";
  
  if (config.entities && typeof config.entities === 'object' && config.entities !== null && Object.keys(config.entities).length > 0) {
    const entityNames = Object.keys(config.entities);
    
    // Add import for repository types if path is provided
    if (repositoryTypesImportPath) {
      repositoryTypesImport = `import type { ${entityNames.map(name => `${name}RepositoryMethods`).join(", ")} } from "${repositoryTypesImportPath}";\n`;
      const entityRepositories = entityNames.map(name => {
        return `  ${name}: ${name}RepositoryMethods;`;
      }).join("\n");
      entitiesType = `{\n${entityRepositories}\n}`;
    } else {
      // Fallback: use Record with entity names as keys when repository types aren't available
      const entityRepositories = entityNames.map(name => {
        return `  ${name}: any;`;
      }).join("\n");
      entitiesType = `{\n${entityRepositories}\n}`;
    }
  }

  // Determine if we need to import DatabaseAdapter
  const needsDbImport = hasDb;
  const dbImport = needsDbImport ? `import type { DatabaseAdapter } from "${handlerContextImportPath}";\n` : "";

  const imports = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

import type { HandlerContext } from "${handlerContextImportPath}";
${dbImport}import type * as Types from "${typesImportPath}";
${repositoryTypesImport}
`;

  // Normalize APIs config (includes operations conversion)
  // Convert schemas to entities format for normalizer
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
    schemas: schemasAsEntities as any,
  });
  const allEndpoints = normalizedApis.rest.flatMap(restConfig => restConfig.endpoints);

  if (allEndpoints.length === 0) {
    return imports + "// No REST endpoints defined\n";
  }

  // Convert entities to schemas and merge with explicit schemas
  const entitySchemas = config.entities ? entitiesToSchemas(config.entities) : {};
  const allSchemas = mergeSchemas(config.schemas, entitySchemas) || {};

  // Group endpoints by handler name (in case multiple endpoints use same handler)
  const handlerEndpoints = new Map<string, NormalizedEndpoint[]>();
  
  for (const endpoint of allEndpoints) {
    if (endpoint.handler && typeof endpoint.handler === 'string') {
      const existing = handlerEndpoints.get(endpoint.handler) || [];
      existing.push(endpoint);
      handlerEndpoints.set(endpoint.handler, existing);
    }
  }

  if (handlerEndpoints.size === 0) {
    return imports + "// No handlers defined in endpoints\n";
  }

  const contextInterfaces: string[] = [];

  for (const [handlerName, endpoints] of handlerEndpoints.entries()) {
    // Use the first endpoint for type generation (if multiple, they should have compatible types)
    const endpoint = endpoints[0];
    const interfaceName = handlerNameToInterfaceName(handlerName);

    // Generate body type
    let bodyType = "unknown";
    if (endpoint.body) {
      // String shorthand - schema reference
      if (typeof endpoint.body === 'string') {
        const bodySchemaType = endpoint.body;
        const arrayMatch = bodySchemaType.match(/^(.+)\[\]$/);
        if (arrayMatch) {
          const baseType = arrayMatch[1];
          if (allSchemas[baseType]) {
            bodyType = `Types.${baseType}[]`;
          } else {
            bodyType = bodySchemaType;
          }
        } else if (allSchemas[bodySchemaType]) {
          bodyType = `Types.${bodySchemaType}`;
        } else {
          bodyType = bodySchemaType;
        }
      }
      // Object with type (schema reference)
      else if (typeof endpoint.body === 'object' && 'type' in endpoint.body && endpoint.body.type) {
        const bodySchemaType = endpoint.body.type;
        const arrayMatch = bodySchemaType.match(/^(.+)\[\]$/);
        if (arrayMatch) {
          const baseType = arrayMatch[1];
          if (allSchemas[baseType]) {
            bodyType = `Types.${baseType}[]`;
          } else {
            bodyType = bodySchemaType;
          }
        } else if (allSchemas[bodySchemaType]) {
          bodyType = `Types.${bodySchemaType}`;
        } else {
          bodyType = bodySchemaType;
        }
      }
      // Object with fields (inline object definition)
      else if (typeof endpoint.body === 'object' && 'fields' in endpoint.body && endpoint.body.fields) {
        // Normalize the body first to ensure fields are properly parsed
        const normalizedBodyDef = normalizeBodyDefinition(endpoint.body);
        if (normalizedBodyDef?.fields) {
          bodyType = generateParamsOrQueryType(normalizedBodyDef.fields, allSchemas, new Set(), true);
        }
      }
    }

    // Normalize and generate params type
    const normalizedParams = normalizeQueryOrParams(endpoint.params);
    const paramsType = generateParamsOrQueryType(normalizedParams, allSchemas, new Set(), true);

    // Normalize and generate query type
    const normalizedQuery = normalizeQueryOrParams(endpoint.query);
    const queryType = generateParamsOrQueryType(normalizedQuery, allSchemas, new Set(), true);

    // Generate response type (for return type hint)
    let responseType = "unknown";
    if (endpoint.response) {
      // Handle response with type (schema reference)
      if ('type' in endpoint.response && endpoint.response.type) {
        const responseSchemaType = endpoint.response.type;
        // Check for array syntax like "User[]"
        const arrayMatch = responseSchemaType.match(/^(.+)\[\]$/);
        if (arrayMatch) {
          const baseType = arrayMatch[1];
          if (allSchemas[baseType]) {
            responseType = `Types.${baseType}[]`;
          } else {
            responseType = responseSchemaType;
          }
        } else if (allSchemas[responseSchemaType]) {
          // Direct schema reference
          responseType = `Types.${responseSchemaType}`;
        } else {
          responseType = responseSchemaType;
        }
      } 
      // Handle response with properties (inline object definition)
      else if ('properties' in endpoint.response && endpoint.response.properties) {
        // Normalize the response properties and generate type inline
        const normalizedResponse = normalizeQueryOrParams(endpoint.response as any);
        if (normalizedResponse) {
          responseType = generateParamsOrQueryType(normalizedResponse, allSchemas, new Set(), true);
        }
      }
    }

    // Build the properties to include based on available services
    const properties: string[] = [
      `  body: ${bodyType};`,
      `  params: ${paramsType};`,
      `  query: ${queryType};`
    ];

    // Always include all HandlerContext utility properties for better IDE autocomplete
    // Make them required when available, optional otherwise
    properties.push(`  // Database access`);
    if (hasDb) {
      properties.push(`  db: DatabaseAdapter;`);
    } else {
      properties.push(`  db?: HandlerContext['db'];`);
    }
    
    if (hasEntities) {
      properties.push(`  entities: ${entitiesType};`);
    } else {
      properties.push(`  entities?: HandlerContext['entities'];`);
    }
    
    properties.push(`  // Cache access`);
    if (hasCache) {
      properties.push(`  cache: NonNullable<HandlerContext['cache']>;`);
    } else {
      properties.push(`  cache?: HandlerContext['cache'];`);
    }
    
    properties.push(`  // Storage access`);
    if (hasStorage) {
      properties.push(`  storage: NonNullable<HandlerContext['storage']>;`);
    } else {
      properties.push(`  storage?: HandlerContext['storage'];`);
    }
    
    properties.push(`  // Realtime access`);
    if (hasRealtime) {
      properties.push(`  realtime: NonNullable<HandlerContext['realtime']>;`);
    } else {
      properties.push(`  realtime?: HandlerContext['realtime'];`);
    }
    
    properties.push(`  // Email service`);
    properties.push(`  email?: HandlerContext['email'];`);
    
    properties.push(`  // Logger service`);
    properties.push(`  logger?: HandlerContext['logger'];`);
    
    properties.push(`  // Metrics service`);
    properties.push(`  metrics?: HandlerContext['metrics'];`);
    
    properties.push(`  // Tracing service`);
    properties.push(`  tracing?: HandlerContext['tracing'];`);
    
    properties.push(`  // Auth context`);
    properties.push(`  auth?: HandlerContext['auth'];`);
    
    properties.push(`  // Response helpers`);
    properties.push(`  status: HandlerContext['status'];`);

    // Build the interface extending HandlerContext (we override specific properties above)
    const interfaceDef = `export interface ${interfaceName} extends Omit<HandlerContext, 'body' | 'params' | 'query'${hasDb ? " | 'db'" : ""}${hasEntities ? " | 'entities'" : ""}${hasCache ? " | 'cache'" : ""}${hasStorage ? " | 'storage'" : ""}${hasRealtime ? " | 'realtime'" : ""}> {
${properties.join("\n")}
}`;

    contextInterfaces.push(interfaceDef);
  }

  return imports + contextInterfaces.join("\n\n") + "\n";
}

