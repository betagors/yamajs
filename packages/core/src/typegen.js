import { entitiesToSchemas, mergeSchemas } from "./entities.js";
import { normalizeQueryOrParams } from "./schemas.js";
/**
 * Convert a Yama schema field to TypeScript type string
 */
function fieldToTypeScript(field, indent = 0, schemas, visited = new Set()) {
    const spaces = "  ".repeat(indent);
    // Handle legacy $ref (deprecated but still supported)
    if (field.$ref) {
        if (visited.has(field.$ref)) {
            throw new Error(`Circular reference detected in type generation: ${field.$ref}`);
        }
        if (!schemas || !schemas[field.$ref]) {
            throw new Error(`Schema reference "${field.$ref}" not found in type generation`);
        }
        // Return the referenced schema name directly
        return field.$ref;
    }
    // Type is required
    if (!field.type) {
        throw new Error(`Field must have a type`);
    }
    const typeStr = String(field.type);
    // Define primitive types that should NOT be treated as schema references
    const primitiveTypes = ["string", "number", "boolean", "integer", "array", "list", "object"];
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
        case "string":
            // Handle enum types
            if (field.enum && Array.isArray(field.enum)) {
                const enumValues = field.enum
                    .map((val) => (typeof val === "string" ? `"${val}"` : String(val)))
                    .join(" | ");
                return enumValues;
            }
            return "string";
        case "number":
        case "integer":
            // Handle enum types for numbers
            if (field.enum && Array.isArray(field.enum)) {
                const enumValues = field.enum.map((val) => String(val)).join(" | ");
                return enumValues;
            }
            return "number";
        case "boolean":
            // Handle enum types for booleans
            if (field.enum && Array.isArray(field.enum)) {
                const enumValues = field.enum.map((val) => String(val)).join(" | ");
                return enumValues;
            }
            return "boolean";
        case "array":
        case "list":
            if (field.items) {
                const itemType = fieldToTypeScript(field.items, indent, schemas, visited);
                return `${itemType}[]`;
            }
            return "unknown[]";
        case "object":
            if (field.properties && typeof field.properties === 'object' && field.properties !== null) {
                const props = [];
                for (const [propName, propField] of Object.entries(field.properties)) {
                    const propType = fieldToTypeScript(propField, indent + 1, schemas, visited);
                    const optional = propField.required ? "" : "?";
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
 */
function generateSchemaType(schemaName, schemaDef, schemas, visited = new Set()) {
    const fields = [];
    if (!schemaDef.fields || typeof schemaDef.fields !== 'object') {
        return `export interface ${schemaName} {}`;
    }
    for (const [fieldName, field] of Object.entries(schemaDef.fields)) {
        const fieldType = fieldToTypeScript(field, 1, schemas, visited);
        const optional = field.required ? "" : "?";
        fields.push(`  ${fieldName}${optional}: ${fieldType};`);
    }
    return `export interface ${schemaName} {\n${fields.join("\n")}\n}`;
}
/**
 * Generate TypeScript types from Yama schemas and entities
 */
export function generateTypes(schemas, entities) {
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
    const typeDefinitions = [];
    for (const [schemaName, schemaDef] of Object.entries(allSchemas)) {
        typeDefinitions.push(generateSchemaType(schemaName, schemaDef, allSchemas));
    }
    return imports + typeDefinitions.join("\n\n") + "\n";
}
/**
 * Convert handler name to TypeScript interface name
 */
function handlerNameToInterfaceName(handlerName) {
    // Convert camelCase to PascalCase and add "HandlerContext" suffix
    const pascalCase = handlerName.charAt(0).toUpperCase() + handlerName.slice(1);
    return `${pascalCase}HandlerContext`;
}
/**
 * Generate TypeScript type for params/query from endpoint definition
 */
function generateParamsOrQueryType(fields, schemas, visited = new Set(), useTypesNamespace = false) {
    if (!fields || typeof fields !== 'object' || fields === null || Object.keys(fields).length === 0) {
        return "{}";
    }
    const props = [];
    for (const [fieldName, field] of Object.entries(fields)) {
        let fieldType = fieldToTypeScript(field, 0, schemas, visited);
        // If using Types namespace and field is a schema reference (not a primitive), prefix with Types.
        // Check if the type is a schema reference by seeing if it exists in schemas
        if (useTypesNamespace && schemas && field.type) {
            const typeStr = String(field.type);
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
                }
                else {
                    fieldType = `Types.${fieldType}`;
                }
            }
        }
        const optional = field.required ? "" : "?";
        props.push(`  ${fieldName}${optional}: ${fieldType};`);
    }
    return `{\n${props.join("\n")}\n}`;
}
/**
 * Generate handler context types from Yama config
 */
export function generateHandlerContexts(config, typesImportPath = "../types", handlerContextImportPath = "@betagors/yama-core", repositoryTypesImportPath, availableServices) {
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
        }
        else {
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
    if (!config.endpoints || config.endpoints.length === 0) {
        return imports + "// No endpoints defined\n";
    }
    // Convert entities to schemas and merge with explicit schemas
    const entitySchemas = config.entities ? entitiesToSchemas(config.entities) : {};
    const allSchemas = mergeSchemas(config.schemas, entitySchemas) || {};
    // Group endpoints by handler name (in case multiple endpoints use same handler)
    const handlerEndpoints = new Map();
    for (const endpoint of config.endpoints) {
        if (endpoint.handler) {
            const existing = handlerEndpoints.get(endpoint.handler) || [];
            existing.push(endpoint);
            handlerEndpoints.set(endpoint.handler, existing);
        }
    }
    if (handlerEndpoints.size === 0) {
        return imports + "// No handlers defined in endpoints\n";
    }
    const contextInterfaces = [];
    for (const [handlerName, endpoints] of handlerEndpoints.entries()) {
        // Use the first endpoint for type generation (if multiple, they should have compatible types)
        const endpoint = endpoints[0];
        const interfaceName = handlerNameToInterfaceName(handlerName);
        // Generate body type
        let bodyType = "unknown";
        if (endpoint.body?.type) {
            const bodySchemaType = endpoint.body.type;
            // Check for array syntax like "User[]"
            const arrayMatch = bodySchemaType.match(/^(.+)\[\]$/);
            if (arrayMatch) {
                const baseType = arrayMatch[1];
                if (allSchemas[baseType]) {
                    bodyType = `Types.${baseType}[]`;
                }
                else {
                    bodyType = bodySchemaType;
                }
            }
            else if (allSchemas[bodySchemaType]) {
                // Direct schema reference
                bodyType = `Types.${bodySchemaType}`;
            }
            else {
                bodyType = bodySchemaType;
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
            if (endpoint.response.type) {
                const responseSchemaType = endpoint.response.type;
                // Check for array syntax like "User[]"
                const arrayMatch = responseSchemaType.match(/^(.+)\[\]$/);
                if (arrayMatch) {
                    const baseType = arrayMatch[1];
                    if (allSchemas[baseType]) {
                        responseType = `Types.${baseType}[]`;
                    }
                    else {
                        responseType = responseSchemaType;
                    }
                }
                else if (allSchemas[responseSchemaType]) {
                    // Direct schema reference
                    responseType = `Types.${responseSchemaType}`;
                }
                else {
                    responseType = responseSchemaType;
                }
            }
            // Handle response with properties (inline object definition)
            else if ('properties' in endpoint.response && endpoint.response.properties) {
                // Normalize the response properties and generate type inline
                const normalizedResponse = normalizeQueryOrParams(endpoint.response);
                if (normalizedResponse) {
                    responseType = generateParamsOrQueryType(normalizedResponse, allSchemas, new Set(), true);
                }
            }
        }
        // Build the properties to include based on available services
        const properties = [
            `  body: ${bodyType};`,
            `  params: ${paramsType};`,
            `  query: ${queryType};`
        ];
        // Add services only if they're available
        if (hasDb) {
            properties.push(`  db: DatabaseAdapter;`);
        }
        if (hasEntities) {
            properties.push(`  entities: ${entitiesType};`);
        }
        if (hasCache) {
            properties.push(`  cache: NonNullable<HandlerContext['cache']>;`);
        }
        if (hasStorage) {
            properties.push(`  storage: NonNullable<HandlerContext['storage']>;`);
        }
        if (hasRealtime) {
            properties.push(`  realtime: NonNullable<HandlerContext['realtime']>;`);
        }
        // Build the interface with Omit to exclude optional properties that we're making required
        const omitProperties = [];
        if (hasDb)
            omitProperties.push("'db'");
        if (hasEntities)
            omitProperties.push("'entities'");
        if (hasCache)
            omitProperties.push("'cache'");
        if (hasStorage)
            omitProperties.push("'storage'");
        if (hasRealtime)
            omitProperties.push("'realtime'");
        const omitType = omitProperties.length > 0
            ? `Omit<HandlerContext, ${omitProperties.join(" | ")}>`
            : "HandlerContext";
        const interfaceDef = `export interface ${interfaceName} extends ${omitType} {
${properties.join("\n")}
}`;
        contextInterfaces.push(interfaceDef);
    }
    return imports + contextInterfaces.join("\n\n") + "\n";
}
//# sourceMappingURL=typegen.js.map