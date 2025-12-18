import type { EntityDefinition, YamaEntities, CrudConfig, EntityField } from "./entities.js";
import type { SchemaField } from "./schemas.js";
import { entityToSchema, normalizeEntityDefinition, parseFieldDefinition } from "./entities.js";
import type { PaginationConfig } from "./pagination/types.js";

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
  // Check if word is already plural (ends with 's' or 'es' but not singular words that end in 's')
  // Words that are already plural typically end with 's' (but not 'ss', 'us', 'is', 'as', 'os')
  // or 'es' (but not 'ies', 'ches', 'shes', 'xes', 'zes')
  if (word.length > 1) {
    // Already ends with 's' - check if it's likely already plural
    if (word.endsWith("s")) {
      // Exceptions: words ending in 'ss', 'us', 'is', 'as', 'os' might be singular
      // But for entity names, if it ends with 's', it's likely already plural
      // Check if it ends with 'es' (likely already plural)
      if (word.endsWith("es")) {
        // Check if it's a plural form (not 'ies', 'ches', 'shes', 'xes', 'zes')
        if (!word.endsWith("ies") && !word.endsWith("ches") && !word.endsWith("shes") && 
            !word.endsWith("xes") && !word.endsWith("zes")) {
          // Already plural (e.g., "posts", "authors", "publishedposts")
          return word;
        }
      } else {
        // Ends with 's' but not 'es' - likely already plural (e.g., "posts", "authors")
        // But check for singular words ending in 's' (like "class", "bus")
        // For entity names, if it ends with 's' and is not a known singular exception, assume plural
        const singularExceptions = ["class", "bus", "gas", "plus", "minus", "status", "focus", "virus"];
        if (!singularExceptions.includes(word.toLowerCase())) {
          // Likely already plural
          return word;
        }
      }
    }
  }
  
  // Apply pluralization rules for singular words
  if (word.endsWith("y")) {
    return word.slice(0, -1) + "ies";
  }
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || word.endsWith("ch") || word.endsWith("sh")) {
    return word + "es";
  }
  return word + "s";
}

/**
 * Convert camelCase/PascalCase to kebab-case
 * Examples: "PublishedPosts" -> "published-posts", "AuthorPosts" -> "author-posts"
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Insert hyphen between lowercase and uppercase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2') // Insert hyphen between consecutive capitals followed by lowercase
    .toLowerCase();
}

/**
 * Check if a word is already plural by checking the last segment
 */
function isLastWordPlural(words: string[]): boolean {
  if (words.length === 0) return false;
  const lastWord = words[words.length - 1];
  // Check if last word ends with 's' (and not in exceptions)
  if (lastWord.endsWith('s') && !lastWord.endsWith('ss')) {
    const singularExceptions = ["class", "bus", "gas", "plus", "minus", "status", "focus", "virus"];
    return !singularExceptions.includes(lastWord.toLowerCase());
  }
  return false;
}

/**
 * Convert entity name to path (e.g., "Example" -> "/examples", "PublishedPosts" -> "/published-posts")
 */
function entityNameToPath(entityName: string, customPath?: string): string {
  if (customPath) {
    return customPath.startsWith("/") ? customPath : `/${customPath}`;
  }
  
  // Convert to kebab-case and split into words
  const kebab = toKebabCase(entityName);
  const words = kebab.split('-');
  
  // Check if the last word is already plural
  if (isLastWordPlural(words)) {
    // Already plural, return as-is
    return `/${kebab}`;
  }
  
  // Pluralize the last word only
  const lastWord = words[words.length - 1];
  const pluralizedLast = pluralize(lastWord);
  words[words.length - 1] = pluralizedLast;
  
  return `/${words.join('-')}`;
}

/**
 * Get primary key field name - optimized with early return
 */
function getPrimaryKeyField(entityDef: EntityDefinition, entityName: string, entities?: YamaEntities): string {
  const normalized = normalizeEntityDefinition(entityName, entityDef, entities);
  const fieldEntries = Object.entries(normalized.fields);
  
  // Early return on first primary key found
  for (let i = 0; i < fieldEntries.length; i++) {
    const [fieldName, field] = fieldEntries[i];
    if (field.primary) {
      return (field.api && typeof field.api === "string") ? field.api : fieldName;
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
 * Get all searchable fields - optimized with pre-allocated array
 */
function getAllSearchableFields(entityDef: EntityDefinition, entityName: string, entities?: YamaEntities): string[] {
  const normalized = normalizeEntityDefinition(entityName, entityDef, entities);
  const searchable: string[] = [];
  const fieldEntries = Object.entries(normalized.fields);
  
  // Pre-filter searchable types
  for (let i = 0; i < fieldEntries.length; i++) {
    const [fieldName, field] = fieldEntries[i];
    if (field.api === false) continue;
    if (field.type !== "string" && field.type !== "text") continue;
    
    // Resolve API field name efficiently
    const apiFieldName = field.api && typeof field.api === "string"
      ? field.api
      : field.dbColumn
      ? field.dbColumn.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
      : fieldName;
    
    searchable.push(apiFieldName);
  }
  
  return searchable;
}

/**
 * Get searchable fields from entity definition based on search config
 * Returns array of API field names that can be searched
 */
function getSearchableFields(
  entityDef: EntityDefinition,
  entityName: string,
  searchConfig?: CrudConfig["search"]
): string[] {
  // Handle simplified syntax: boolean
  if (typeof searchConfig === "boolean") {
    if (searchConfig === false) {
      return []; // Explicitly disabled
    }
    // true - use all searchable fields
    return getAllSearchableFields(entityDef, entityName);
  }

  // Handle simplified syntax: array of field names
  if (Array.isArray(searchConfig)) {
    return searchConfig;
  }

  // Handle object config
  if (searchConfig && typeof searchConfig === "object") {
    // If search config specifies fields, use those
    if (searchConfig.fields) {
      if (Array.isArray(searchConfig.fields)) {
        return searchConfig.fields;
      }
      if (searchConfig.fields === true) {
        return getAllSearchableFields(entityDef, entityName);
      }
    }
  }

  // Default: return all string/text fields (auto-enabled)
  return getAllSearchableFields(entityDef, entityName);
}

/**
 * Check if search should be enabled for an entity
 * Returns true if entity has searchable fields and search is not explicitly disabled
 */
function shouldEnableSearch(
  entityDef: EntityDefinition,
  entityName: string,
  crudConfig?: CrudConfig | boolean
): boolean {
  // If CRUD is not enabled or is a boolean, check if entity has searchable fields
  if (!crudConfig || typeof crudConfig === "boolean") {
    return getAllSearchableFields(entityDef, entityName).length > 0;
  }

  // Check search config
  const searchConfig = crudConfig.search;
  
  // Explicitly disabled
  if (searchConfig === false) {
    return false;
  }

  // Explicitly enabled or has searchable fields
  if (searchConfig === true || Array.isArray(searchConfig) || (searchConfig && typeof searchConfig === "object")) {
    return true;
  }

  // Auto-enable if entity has searchable fields
  return getAllSearchableFields(entityDef, entityName).length > 0;
}

/**
 * Get search mode from config (default: "contains")
 */
function getSearchMode(searchConfig?: CrudConfig["search"]): "contains" | "starts" | "ends" | "exact" {
  if (searchConfig && typeof searchConfig === "object" && !Array.isArray(searchConfig) && searchConfig.mode) {
    return searchConfig.mode;
  }
  return "contains";
}

/**
 * Check if full-text search should be enabled (default: true)
 */
function shouldEnableFullText(searchConfig?: CrudConfig["search"]): boolean {
  if (searchConfig && typeof searchConfig === "object" && !Array.isArray(searchConfig)) {
    return searchConfig.fullText !== false; // Default to true unless explicitly false
  }
  return true; // Default enabled
}

/**
 * Check if a method should be generated based on CRUD config
 * Supports both individual methods and method groups (read, write, mutate, etc.)
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
    // Check for exact method match
    if (method in crudConfig.enabled) {
      return true;
    }

    // Check for method group matches (e.g., "write" applies to POST, PUT, PATCH, DELETE)
    for (const key of Object.keys(crudConfig.enabled)) {
      if (methodBelongsToGroup(method, key)) {
        return true;
      }
    }
  }

  return true; // Default to enabled
}

/**
 * Method groups for convenient auth configuration
 * Maps group names to their corresponding HTTP methods
 */
const METHOD_GROUPS: Record<string, string[]> = {
  read: ["GET"],
  write: ["POST", "PUT", "PATCH", "DELETE"],
  mutate: ["POST", "PUT", "PATCH", "DELETE"], // Alias for write
  create: ["POST"],
  update: ["PUT", "PATCH"],
  delete: ["DELETE"],
};

/**
 * Check if a method belongs to a group
 */
function methodBelongsToGroup(method: string, group: string): boolean {
  const methods = METHOD_GROUPS[group.toLowerCase()];
  return methods ? methods.includes(method) : false;
}

/**
 * Get method-specific config from CRUD config
 * Supports both individual methods and method groups (read, write, mutate, etc.)
 */
function getMethodConfig(
  method: string,
  crudConfig: CrudConfig | boolean
): { auth?: { required?: boolean; roles?: string[]; permissions?: string[]; handler?: string }; path?: string; inputType?: string; responseType?: string } | undefined {
  if (typeof crudConfig === "boolean") {
    return undefined;
  }

  if (typeof crudConfig.enabled === "object" && !Array.isArray(crudConfig.enabled)) {
    // First, check for exact method match
    if (method in crudConfig.enabled) {
      return crudConfig.enabled[method];
    }

    // Then, check for method group matches (e.g., "write" applies to POST, PUT, PATCH, DELETE)
    for (const [key, config] of Object.entries(crudConfig.enabled)) {
      if (methodBelongsToGroup(method, key)) {
        return config;
      }
    }
  }

  return undefined;
}

/**
 * Get custom input type for a method from CRUD config
 * Checks method-specific config first, then top-level inputTypes
 */
function getInputType(
  method: string,
  crudConfig: CrudConfig | boolean,
  defaultType: string
): string {
  if (typeof crudConfig === "boolean") {
    return defaultType;
  }

  // Check method-specific config first
  const methodConfig = getMethodConfig(method, crudConfig);
  if (methodConfig?.inputType) {
    return methodConfig.inputType;
  }

  // Check top-level inputTypes
  if (crudConfig.inputTypes && method in crudConfig.inputTypes) {
    return crudConfig.inputTypes[method];
  }

  return defaultType;
}

/**
 * Get custom response type for a method from CRUD config
 */
function getResponseType(
  method: string,
  crudConfig: CrudConfig | boolean,
  defaultType: string,
  endpointType?: "list" | "one"
): string {
  if (typeof crudConfig === "boolean") {
    return defaultType;
  }

  // For GET endpoints, use GET_LIST or GET_ONE
  if (method === "GET" && endpointType) {
    const specificMethod = endpointType === "list" ? "GET_LIST" : "GET_ONE";
    
    const methodConfig = getMethodConfig(specificMethod, crudConfig);
    if (methodConfig?.responseType) {
      return methodConfig.responseType;
    }
    
    if (crudConfig.responseTypes?.[specificMethod]) {
      return crudConfig.responseTypes[specificMethod];
    }
  }

  // For other methods, check method-specific config then top-level
  const methodConfig = getMethodConfig(method, crudConfig);
  if (methodConfig?.responseType) {
    return methodConfig.responseType;
  }

  if (crudConfig.responseTypes?.[method]) {
    return crudConfig.responseTypes[method];
  }

  return defaultType;
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
  if (!crudConfig) {
    return [];
  }

  const basePath = entityNameToPath(
    entityName,
    typeof crudConfig === "object" ? crudConfig.path : undefined
  );
  const schemaName = entityDef.apiSchema || entityName;
  const primaryKey = getPrimaryKeyField(entityDef, entityName, entities);
  const createInputName = generateInputSchemaName(schemaName, "Create");
  const updateInputName = generateInputSchemaName(schemaName, "Update");
  const arraySchemaName = generateArraySchemaName(schemaName);

  // Get default auth from crud config
  const defaultAuth = typeof crudConfig === "object" ? crudConfig.auth : undefined;

  const endpoints: CrudEndpoint[] = [];

  // GET /{path} - List all
  if (shouldGenerateMethod("GET", crudConfig)) {
    const methodConfig = getMethodConfig("GET", crudConfig);
    const responseType = getResponseType("GET", crudConfig, arraySchemaName, "list");
    
    // Build query parameters based on pagination config
    const queryParams: Record<string, SchemaField> = {};
    
    // Handle pagination config
    const paginationConfig = typeof crudConfig === "object" ? crudConfig.pagination : undefined;
    if (paginationConfig === undefined || paginationConfig === true) {
      // Default: offset pagination
      queryParams.limit = { type: "number", required: false };
      queryParams.offset = { type: "number", required: false };
    } else if (typeof paginationConfig === "object") {
      if (paginationConfig.type === "page" || !paginationConfig.type) {
        // Page-based pagination (or default to page if type not specified but page/pageSize provided)
        queryParams.page = { type: "number", required: false };
        queryParams.pageSize = { type: "number", required: false };
      } else if (paginationConfig.type === "cursor") {
        // Cursor-based pagination
        queryParams.cursor = { type: "string", required: false };
        queryParams.limit = { type: "number", required: false };
      } else {
        // Offset pagination (explicit)
        queryParams.limit = { type: "number", required: false };
        queryParams.offset = { type: "number", required: false };
      }
    }

    // Auto-enable search if entity has searchable fields (smart defaults)
    const searchEnabled = shouldEnableSearch(entityDef, entityName, crudConfig);
    if (searchEnabled) {
      const searchConfig = typeof crudConfig === "object" ? crudConfig.search : undefined;
      // Add full-text search parameter (enabled by default)
      if (shouldEnableFullText(searchConfig)) {
        queryParams.search = { type: "string", required: false };
      }
      // Individual field search is handled by existing query param matching
    }

    endpoints.push({
      path: basePath,
      method: "GET",
      description: `List all ${schemaName} records`,
      query: queryParams,
      response: {
        type: responseType,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // GET /{path}/:id - Get by ID
  if (shouldGenerateMethod("GET", crudConfig)) {
    const methodConfig = getMethodConfig("GET", crudConfig);
    const responseType = getResponseType("GET", crudConfig, schemaName, "one");
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "GET",
      description: `Get ${schemaName} by ${primaryKey}`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      response: {
        type: responseType,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // POST /{path} - Create
  if (shouldGenerateMethod("POST", crudConfig)) {
    const methodConfig = getMethodConfig("POST", crudConfig);
    const inputType = getInputType("POST", crudConfig, createInputName);
    const responseType = getResponseType("POST", crudConfig, schemaName);
    endpoints.push({
      path: basePath,
      method: "POST",
      description: `Create a new ${schemaName}`,
      body: {
        type: inputType,
      },
      response: {
        type: responseType,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // PUT /{path}/:id - Update (full)
  if (shouldGenerateMethod("PUT", crudConfig)) {
    const methodConfig = getMethodConfig("PUT", crudConfig);
    const inputType = getInputType("PUT", crudConfig, updateInputName);
    const responseType = getResponseType("PUT", crudConfig, schemaName);
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "PUT",
      description: `Update ${schemaName} by ${primaryKey} (full update)`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      body: {
        type: inputType,
      },
      response: {
        type: responseType,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // PATCH /{path}/:id - Update (partial)
  if (shouldGenerateMethod("PATCH", crudConfig)) {
    const methodConfig = getMethodConfig("PATCH", crudConfig);
    const inputType = getInputType("PATCH", crudConfig, updateInputName);
    const responseType = getResponseType("PATCH", crudConfig, schemaName);
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "PATCH",
      description: `Update ${schemaName} by ${primaryKey} (partial update)`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      body: {
        type: inputType,
      },
      response: {
        type: responseType,
      },
      auth: methodConfig?.auth || defaultAuth,
    });
  }

  // DELETE /{path}/:id - Delete
  if (shouldGenerateMethod("DELETE", crudConfig)) {
    const methodConfig = getMethodConfig("DELETE", crudConfig);
    const responseType = getResponseType("DELETE", crudConfig, "object");
    endpoints.push({
      path: `${basePath}/:${primaryKey}`,
      method: "DELETE",
      description: `Delete ${schemaName} by ${primaryKey}`,
      params: {
        [primaryKey]: { type: "string", required: true },
      },
      response: {
        type: responseType,
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
  
  // Check if variants are defined - if so, use them for explicit control
  // Variants allow you to explicitly include/exclude fields like id, createdAt, updatedAt
  if (entityDef.variants && (entityDef.variants.create || entityDef.variants.update)) {
    const { VariantGenerator } = require('./variants/generator.js');
    const result: Record<string, { fields: Record<string, SchemaField> }> = {};
    
    // Convert baseSchema fields to FieldType format for VariantGenerator
    const baseFieldsAsFieldType: Record<string, any> = {};
    for (const [fieldName, schemaField] of Object.entries(baseSchema.fields)) {
      baseFieldsAsFieldType[fieldName] = {
        type: schemaField.type,
        nullable: !schemaField.required,
        default: schemaField.default,
      };
    }
    
    // Use create variant if defined
    if (entityDef.variants.create) {
      const createVariant = VariantGenerator.generate(
        { fields: baseFieldsAsFieldType, computed: entityDef.computed },
        entityDef.variants.create
      );
      // Convert FieldType back to SchemaField
      const createFields: Record<string, SchemaField> = {};
      for (const [fieldName, fieldType] of Object.entries(createVariant.fields)) {
        const ft = fieldType as any; // FieldType from VariantGenerator
        createFields[fieldName] = {
          type: ft.type as SchemaField['type'],
          required: !ft.nullable,
          default: ft.default,
          format: (ft.type === 'timestamp' || ft.type === 'timestamptz' || ft.type === 'datetime') ? 'date-time' : undefined,
        };
      }
      result[createInputName] = { fields: createFields };
    }
    
    // Use update variant if defined
    if (entityDef.variants.update) {
      const updateVariant = VariantGenerator.generate(
        { fields: baseFieldsAsFieldType, computed: entityDef.computed },
        entityDef.variants.update
      );
      // Convert FieldType back to SchemaField
      const updateFields: Record<string, SchemaField> = {};
      for (const [fieldName, fieldType] of Object.entries(updateVariant.fields)) {
        const ft = fieldType as any; // FieldType from VariantGenerator
        updateFields[fieldName] = {
          type: ft.type as SchemaField['type'],
          required: false, // Update fields are always optional (partial: true is implied)
          default: ft.default,
          format: (ft.type === 'timestamp' || ft.type === 'timestamptz' || ft.type === 'datetime') ? 'date-time' : undefined,
        };
      }
      result[updateInputName] = { fields: updateFields };
    }
    
    // Fill in missing variants with auto-generated ones
    if (!result[createInputName] || !result[updateInputName]) {
      // Continue to auto-generation for missing variants
    } else {
      // Both variants defined, return early
      return result;
    }
  }
  
  // Normalize entity definition to handle shorthand syntax
  const normalized = normalizeEntityDefinition(entityName, entityDef, undefined);

  // Create input: exclude primary key, generated fields, readonly fields, and auto-updated fields
  // Use the base schema fields directly (they already have correct API field names)
  const createFields: Record<string, SchemaField> = {};
  // Common timestamp field names that should be excluded from create input
  const timestampFieldNames = ['createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at'];
  
  for (const [fieldName, field] of Object.entries(normalized.fields)) {
    // Skip primary key and generated fields for create
    if (field.primary || field.generated) {
      continue;
    }
    // Skip readonly fields (e.g., createdAt, updatedAt with readonly modifier)
    if (field.readonly) {
      continue;
    }
    // Skip auto-updated fields (e.g., updatedAt with autoUpdate modifier)
    if (field.autoUpdate) {
      continue;
    }
    // Skip fields with default functions like now() - these are auto-generated
    // Check if default is a function name (string) that suggests auto-generation
    if (field.default && typeof field.default === 'string' && 
        (field.default === 'now()' || field.default === 'now' || 
         field.default.includes('()') && (field.default.includes('now') || field.default.includes('uuid')))) {
      continue;
    }
    // Skip common timestamp fields that are conventionally auto-generated
    // (createdAt, updatedAt, deletedAt, etc.) - these should not be in create input
    if (timestampFieldNames.includes(fieldName) && (field.type === 'timestamp' || field.type === 'timestamptz' || field.type === 'datetimelocal' || field.type === 'datetime')) {
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

    // Double-check: if this field was excluded above, don't add it even if it exists in baseSchema
    // (baseSchema might have it for response schemas, but we don't want it in input schemas)
    if (timestampFieldNames.includes(apiFieldName) || timestampFieldNames.includes(fieldName)) {
      continue; // Skip timestamp fields even if they exist in baseSchema
    }
    
    // Also skip 'id' field - it's always auto-generated for create operations
    if (apiFieldName === 'id' || fieldName === 'id') {
      continue;
    }

    const schemaField = baseSchema.fields[apiFieldName];
    if (schemaField) {
      createFields[apiFieldName] = { ...schemaField };
    }
  }

  // Update input: exclude primary key (in path), generated fields, readonly fields, auto-updated fields, and timestamps
  const updateFields: Record<string, SchemaField> = {};
  for (const [fieldName, field] of Object.entries(normalized.fields)) {
    // Skip primary key for update (it's in the path)
    if (field.primary) {
      continue;
    }
    // Skip generated fields
    if (field.generated) {
      continue;
    }
    // Skip readonly fields (e.g., createdAt, updatedAt with readonly modifier)
    if (field.readonly) {
      continue;
    }
    // Skip auto-updated fields (e.g., updatedAt with autoUpdate modifier)
    if (field.autoUpdate) {
      continue;
    }
    // Skip fields with default functions like now() - these are auto-generated
    if (field.default && typeof field.default === 'string' && 
        (field.default === 'now()' || field.default === 'now' || 
         field.default.includes('()') && (field.default.includes('now') || field.default.includes('uuid')))) {
      continue;
    }
    // Skip common timestamp fields that are conventionally auto-generated
    // (createdAt, updatedAt, deletedAt, etc.) - these should not be in update input
    if (timestampFieldNames.includes(fieldName) && (field.type === 'timestamp' || field.type === 'timestamptz' || field.type === 'datetimelocal' || field.type === 'datetime')) {
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

    // Double-check: skip timestamp fields and id even if they exist in baseSchema
    if (timestampFieldNames.includes(apiFieldName) || timestampFieldNames.includes(fieldName)) {
      continue;
    }
    if (apiFieldName === 'id' || fieldName === 'id') {
      continue;
    }

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
          type: "list",
          required: true,
          items: {
            $ref: schemaName,
          } as SchemaField,
        },
      },
    },
  };
}

