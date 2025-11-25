import type { EntityDefinition, YamaEntities, CrudConfig } from "./entities";
import type { SchemaField } from "./schemas";
import { entityToSchema } from "./entities";

/**
 * Endpoint definition for CRUD operations
 */
export interface CrudEndpoint {
  path: string;
  method: string;
  description?: string;
  params?: Record<string, SchemaField>;
  query?: Record<string, SchemaField>;
  body?: {
    type: string;
  };
  response?: {
    type: string;
  };
  auth?: {
    required?: boolean;
    roles?: string[];
  };
}

/**
 * Pluralize a word (simple implementation)
 */
function pluralize(word: string): string {
  // Simple pluralization rules
  if (word.endsWith("y")) {
    return word.slice(0, -1) + "ies";
  }
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || word.endsWith("ch") || word.endsWith("sh")) {
    return word + "es";
  }
  return word + "s";
}

/**
 * Convert entity name to path (e.g., "Example" -> "/examples")
 */
function entityNameToPath(entityName: string, customPath?: string): string {
  if (customPath) {
    return customPath.startsWith("/") ? customPath : `/${customPath}`;
  }
  const lower = entityName.toLowerCase();
  const plural = pluralize(lower);
  return `/${plural}`;
}

/**
 * Get primary key field name from entity
 */
function getPrimaryKeyField(entityDef: EntityDefinition): string {
  for (const [fieldName, field] of Object.entries(entityDef.fields)) {
    if (field.primary) {
      // Return API field name if available
      if (field.api && typeof field.api === "string") {
        return field.api;
      }
      return fieldName;
    }
  }
  return "id"; // Default fallback
}

/**
 * Generate input schema name (e.g., "CreateExampleInput", "UpdateExampleInput")
 */
function generateInputSchemaName(entityName: string, operation: "Create" | "Update"): string {
  return `${operation}${entityName}Input`;
}

/**
 * Generate array response schema name (e.g., "ExampleArray")
 */
function generateArraySchemaName(entityName: string): string {
  return `${entityName}Array`;
}

/**
 * Check if a method should be generated based on CRUD config
 */
function shouldGenerateMethod(
  method: string,
  crudConfig: CrudConfig | boolean
): boolean {
  if (typeof crudConfig === "boolean") {
    return crudConfig;
  }

  if (crudConfig.enabled === false) {
    return false;
  }

  if (crudConfig.enabled === true) {
    return true;
  }

  if (Array.isArray(crudConfig.enabled)) {
    return crudConfig.enabled.includes(method);
  }

  if (typeof crudConfig.enabled === "object") {
    return method in crudConfig.enabled;
  }

  return true; // Default to enabled
}

/**
 * Get method-specific config from CRUD config
 */
function getMethodConfig(
  method: string,
  crudConfig: CrudConfig | boolean
): { auth?: { required?: boolean; roles?: string[] }; path?: string } | undefined {
  if (typeof crudConfig === "boolean") {
    return undefined;
  }

  if (typeof crudConfig.enabled === "object" && !Array.isArray(crudConfig.enabled)) {
    return crudConfig.enabled[method];
  }

  return undefined;
}

/**
 * Generate CRUD endpoints for an entity
 */
export function generateCrudEndpoints(
  entityName: string,
  entityDef: EntityDefinition,
  entities: YamaEntities
): CrudEndpoint[] {
  const crudConfig = entityDef.crud;
  
  // If CRUD is not enabled, return empty array
  if (!crudConfig || crudConfig === false) {
    return [];
  }

  const basePath = entityNameToPath(
    entityName,
    typeof crudConfig === "object" ? crudConfig.path : undefined
  );
  const schemaName = entityDef.apiSchema || entityName;
  const primaryKey = getPrimaryKeyField(entityDef);
  const createInputName = generateInputSchemaName(schemaName, "Create");
  const updateInputName = generateInputSchemaName(schemaName, "Update");
  const arraySchemaName = generateArraySchemaName(schemaName);

  // Get default auth from crud config
  const defaultAuth = typeof crudConfig === "object" ? crudConfig.auth : undefined;

  const endpoints: CrudEndpoint[] = [];

  // GET /{path} - List all
  if (shouldGenerateMethod("GET", crudConfig)) {
    const methodConfig = getMethodConfig("GET", crudConfig);
    endpoints.push({
      path: basePath,
      method: "GET",
      description: `List all ${schemaName} records`,
      query: {
        limit: { type: "number", required: false },
        offset: { type: "number", required: false },
      },
      response: {
        type: arraySchemaName,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // GET /{path}/:id - Get by ID
  if (shouldGenerateMethod("GET", crudConfig)) {
    const methodConfig = getMethodConfig("GET", crudConfig);
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "GET",
      description: `Get ${schemaName} by ${primaryKey}`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      response: {
        type: schemaName,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // POST /{path} - Create
  if (shouldGenerateMethod("POST", crudConfig)) {
    const methodConfig = getMethodConfig("POST", crudConfig);
    endpoints.push({
      path: basePath,
      method: "POST",
      description: `Create a new ${schemaName}`,
      body: {
        type: createInputName,
      },
      response: {
        type: schemaName,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // PUT /{path}/:id - Update (full)
  if (shouldGenerateMethod("PUT", crudConfig)) {
    const methodConfig = getMethodConfig("PUT", crudConfig);
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "PUT",
      description: `Update ${schemaName} by ${primaryKey} (full update)`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      body: {
        type: updateInputName,
      },
      response: {
        type: schemaName,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // PATCH /{path}/:id - Update (partial)
  if (shouldGenerateMethod("PATCH", crudConfig)) {
    const methodConfig = getMethodConfig("PATCH", crudConfig);
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "PATCH",
      description: `Update ${schemaName} by ${primaryKey} (partial update)`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      body: {
        type: updateInputName,
      },
      response: {
        type: schemaName,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // DELETE /{path}/:id - Delete
  if (shouldGenerateMethod("DELETE", crudConfig)) {
    const methodConfig = getMethodConfig("DELETE", crudConfig);
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "DELETE",
      description: `Delete ${schemaName} by ${primaryKey}`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      response: {
        type: "object", // Simple success response
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  return endpoints;
}

/**
 * Generate CRUD endpoints for all entities
 */
export function generateAllCrudEndpoints(entities: YamaEntities): CrudEndpoint[] {
  const endpoints: CrudEndpoint[] = [];

  for (const [entityName, entityDef] of Object.entries(entities)) {
    const crudEndpoints = generateCrudEndpoints(entityName, entityDef, entities);
    endpoints.push(...crudEndpoints);
  }

  return endpoints;
}

/**
 * Generate input schemas for CRUD operations (Create and Update)
 */
export function generateCrudInputSchemas(
  entityName: string,
  entityDef: EntityDefinition
): Record<string, { fields: Record<string, SchemaField> }> {
  const schemaName = entityDef.apiSchema || entityName;
  const createInputName = generateInputSchemaName(schemaName, "Create");
  const updateInputName = generateInputSchemaName(schemaName, "Update");

  // Get the base schema
  const baseSchema = entityToSchema(entityName, entityDef);

  // Create input: exclude primary key and generated fields
  // Use the base schema fields directly (they already have correct API field names)
  const createFields: Record<string, SchemaField> = {};
  for (const [fieldName, field] of Object.entries(entityDef.fields)) {
    // Skip primary key and generated fields for create
    if (field.primary || field.generated) {
      continue;
    }
    // Skip if api is false
    if (field.api === false) {
      continue;
    }

    // Find the corresponding field in the base schema (using entityToSchema logic)
    // We need to determine the API field name the same way entityToSchema does
    const apiFieldName = field.api && typeof field.api === "string"
      ? field.api
      : field.dbColumn
      ? field.dbColumn.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      : fieldName;

    const schemaField = baseSchema.fields[apiFieldName];
    if (schemaField) {
      createFields[apiFieldName] = { ...schemaField };
    }
  }

  // Update input: all fields optional except primary key
  const updateFields: Record<string, SchemaField> = {};
  for (const [fieldName, field] of Object.entries(entityDef.fields)) {
    // Skip primary key for update (it's in the path)
    if (field.primary) {
      continue;
    }
    // Skip if api is false
    if (field.api === false) {
      continue;
    }

    // Find the corresponding field in the base schema
    const apiFieldName = field.api && typeof field.api === "string"
      ? field.api
      : field.dbColumn
      ? field.dbColumn.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      : fieldName;

    const schemaField = baseSchema.fields[apiFieldName];
    if (schemaField) {
      updateFields[apiFieldName] = { ...schemaField, required: false };
    }
  }

  return {
    [createInputName]: { fields: createFields },
    [updateInputName]: { fields: updateFields },
  };
}

/**
 * Generate array schema for list responses
 */
export function generateArraySchema(
  entityName: string,
  entityDef: EntityDefinition
): Record<string, { fields: Record<string, SchemaField> }> {
  const schemaName = entityDef.apiSchema || entityName;
  const arraySchemaName = generateArraySchemaName(schemaName);

  return {
    [arraySchemaName]: {
      fields: {
        items: {
          type: "array",
          required: true,
          items: {
            $ref: schemaName,
          } as SchemaField,
        },
      },
    },
  };
}

