import Ajv from "ajv";
import addFormats from "ajv-formats";
/**
 * Normalize type: convert "list" to "array" for internal processing
 */
function normalizeType(type) {
    return type === "list" ? "array" : type;
}
/**
 * Normalize a schema from OpenAPI/JSON Schema format to internal format
 * Handles schemas with either:
 * - Internal format: { fields: {...} }
 * - OpenAPI format: { type: "object", properties: {...} }
 */
export function normalizeSchemaDefinition(schemaDef) {
    // Validate input
    if (!schemaDef || typeof schemaDef !== 'object' || schemaDef === null) {
        throw new Error(`Invalid schema definition: expected an object, but got ${typeof schemaDef}`);
    }
    // Already in internal format
    if ('fields' in schemaDef && schemaDef.fields && typeof schemaDef.fields === 'object' && schemaDef.fields !== null) {
        return schemaDef;
    }
    // OpenAPI/JSON Schema format - convert to internal format
    // type: "object" is optional - if properties exists, it's assumed to be an object
    if ('properties' in schemaDef && (!('type' in schemaDef) || schemaDef.type === 'object')) {
        const properties = schemaDef.properties;
        if (!properties || typeof properties !== 'object' || properties === null) {
            throw new Error(`Invalid schema definition: expected properties to be an object, but got ${typeof properties}`);
        }
        const fields = {};
        const requiredFields = new Set(schemaDef.required || []);
        // Ensure properties is a valid object before calling Object.entries
        if (properties && typeof properties === 'object' && properties !== null) {
            for (const [fieldName, fieldDef] of Object.entries(properties)) {
                if (!fieldDef || typeof fieldDef !== 'object') {
                    throw new Error(`Invalid field definition for "${fieldName}": expected an object, but got ${typeof fieldDef}`);
                }
                fields[fieldName] = {
                    ...fieldDef,
                    required: requiredFields.has(fieldName) || fieldDef.required === true
                };
            }
        }
        return { fields };
    }
    // Unknown format or missing required properties
    const keys = Object.keys(schemaDef);
    throw new Error(`Invalid schema definition format. Expected either ` +
        `{ fields: {...} } or { type: "object", properties: {...} }, ` +
        `but got an object with keys: ${keys.length > 0 ? keys.join(', ') : '(empty object)'}`);
}
/**
 * Normalize query/params from schema format to internal format
 * Handles both:
 * - Schema format: { type?: "object", properties: {...}, required?: [...] }
 *   (type: "object" is optional - if properties exists, it's assumed to be an object)
 * - Internal format: Record<string, SchemaField>
 */
export function normalizeQueryOrParams(queryOrParams) {
    if (!queryOrParams || typeof queryOrParams !== 'object' || queryOrParams === null) {
        return undefined;
    }
    // Schema format - if properties exists, treat as object schema (type is optional)
    if ('properties' in queryOrParams) {
        const properties = queryOrParams.properties;
        if (!properties || typeof properties !== 'object' || properties === null) {
            return undefined;
        }
        const fields = {};
        // Ensure required is an array of strings
        const requiredArray = Array.isArray(queryOrParams.required)
            ? queryOrParams.required
            : (queryOrParams.required ? [] : []);
        const requiredFields = new Set(requiredArray);
        for (const [fieldName, fieldDef] of Object.entries(properties)) {
            if (!fieldDef || typeof fieldDef !== 'object') {
                continue;
            }
            // Ensure type is set - if properties exist but no type, default to "object"
            const normalizedField = {
                ...fieldDef,
                required: requiredFields.has(fieldName) || fieldDef.required === true
            };
            // If field has properties but no type, set type to "object"
            if (!normalizedField.type && 'properties' in fieldDef && fieldDef.properties) {
                normalizedField.type = "object";
            }
            fields[fieldName] = normalizedField;
        }
        return fields;
    }
    // Already in internal format (Record<string, SchemaField>)
    // Check if it's already a Record<string, SchemaField> by checking if values are SchemaField-like
    const firstValue = Object.values(queryOrParams)[0];
    if (firstValue && typeof firstValue === 'object' && ('type' in firstValue || '$ref' in firstValue || 'required' in firstValue)) {
        return queryOrParams;
    }
    // Fallback: return as-is if it looks like Record<string, SchemaField>
    return queryOrParams;
}
/**
 * Check if a type string is a schema reference (e.g., "User", "User[]")
 */
function isSchemaReference(type, schemas) {
    if (!schemas)
        return false;
    // Check for array syntax like "User[]"
    const arrayMatch = type.match(/^(.+)\[\]$/);
    if (arrayMatch) {
        return schemas[arrayMatch[1]] !== undefined;
    }
    // Check for direct schema reference
    return schemas[type] !== undefined;
}
/**
 * Convert Yama schema field to JSON Schema property
 */
export function fieldToJsonSchema(field, fieldName, schemas, visited = new Set()) {
    // Handle legacy $ref (deprecated but still supported)
    if (field.$ref) {
        if (visited.has(field.$ref)) {
            throw new Error(`Circular reference detected: ${field.$ref}`);
        }
        if (!schemas || !schemas[field.$ref]) {
            throw new Error(`Schema reference "${field.$ref}" not found`);
        }
        // Recursively convert the referenced schema
        visited.add(field.$ref);
        const referencedSchema = schemas[field.$ref];
        const schema = schemaToJsonSchema(field.$ref, referencedSchema, schemas, visited);
        visited.delete(field.$ref);
        return schema;
    }
    // Type is required
    if (!field.type) {
        throw new Error(`Field "${fieldName}" must have a type`);
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
        // Return JSON Schema array with $ref
        return {
            type: "array",
            items: {
                $ref: `#/definitions/${baseType}`
            }
        };
    }
    // Handle direct schema reference (e.g., type: "User")
    // Only if it's NOT a primitive type and it exists in schemas
    if (!isPrimitive && schemas && schemas[typeStr]) {
        if (visited.has(typeStr)) {
            throw new Error(`Circular reference detected: ${typeStr}`);
        }
        // Return JSON Schema $ref format
        return {
            $ref: `#/definitions/${typeStr}`
        };
    }
    // Handle primitive types
    const normalizedType = normalizeType(typeStr);
    const schema = {
        type: normalizedType === "integer" ? "integer" : normalizedType
    };
    // Add format if specified
    if (field.format) {
        schema.format = field.format;
    }
    // Add enum if specified
    if (field.enum) {
        schema.enum = field.enum;
    }
    // Add pattern for strings
    if (field.pattern) {
        schema.pattern = field.pattern;
    }
    // Add min/max for numbers
    if (field.min !== undefined) {
        schema.minimum = field.min;
    }
    if (field.max !== undefined) {
        schema.maximum = field.max;
    }
    // Handle legacy array/list types with items property
    if ((normalizedType === "array" || normalizedType === "list") && field.items) {
        schema.items = fieldToJsonSchema(field.items, "item", schemas, visited);
    }
    // Handle object types
    if (normalizedType === "object" && field.properties) {
        // Defensive check: ensure properties is a valid object before calling Object.entries
        if (!field.properties || typeof field.properties !== 'object' || field.properties === null) {
            throw new Error(`Field "${fieldName}" has invalid properties. ` +
                `Expected an object, but got: ${typeof field.properties}`);
        }
        const properties = {};
        const required = [];
        for (const [propName, propField] of Object.entries(field.properties)) {
            properties[propName] = fieldToJsonSchema(propField, propName, schemas, visited);
            if (propField.required) {
                required.push(propName);
            }
        }
        schema.properties = properties;
        schema.required = required;
    }
    return schema;
}
/**
 * Convert Yama schema definition to JSON Schema
 */
export function schemaToJsonSchema(schemaName, schemaDef, schemas, visited = new Set()) {
    // Normalize schema to internal format
    let normalizedSchema;
    try {
        normalizedSchema = normalizeSchemaDefinition(schemaDef);
    }
    catch (error) {
        throw new Error(`Failed to normalize schema "${schemaName}": ${error instanceof Error ? error.message : String(error)}`);
    }
    // Validate that fields exist and is an object
    if (!normalizedSchema.fields || typeof normalizedSchema.fields !== 'object' || normalizedSchema.fields === null) {
        throw new Error(`Schema "${schemaName}" has invalid or missing fields. ` +
            `Expected an object with field definitions, but got: ${typeof normalizedSchema.fields}. ` +
            `Schema definition keys: ${Object.keys(normalizedSchema).join(', ')}`);
    }
    const properties = {};
    const required = [];
    // Defensive check before Object.entries
    const fieldsToProcess = normalizedSchema.fields;
    if (!fieldsToProcess || typeof fieldsToProcess !== 'object' || fieldsToProcess === null) {
        throw new Error(`Schema "${schemaName}" has invalid fields object. ` +
            `Cannot iterate over fields: ${typeof fieldsToProcess}`);
    }
    for (const [fieldName, field] of Object.entries(fieldsToProcess)) {
        try {
            properties[fieldName] = fieldToJsonSchema(field, fieldName, schemas, visited);
            if (field.required) {
                required.push(fieldName);
            }
        }
        catch (error) {
            throw new Error(`Failed to convert field "${fieldName}" in schema "${schemaName}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const schema = {
        type: "object",
        properties,
        required
    };
    return schema;
}
/**
 * Schema validator class
 */
export class SchemaValidator {
    constructor() {
        this.validators = new Map();
        this.ajv = new Ajv({
            allErrors: true,
            strict: false,
            validateSchema: false // Don't validate schema structure itself
        });
        addFormats(this.ajv);
    }
    /**
     * Register schemas and create validators
     */
    registerSchemas(schemas) {
        this.validators.clear();
        // Build definitions map for $ref support
        const definitions = {};
        for (const [schemaName, schemaDef] of Object.entries(schemas)) {
            const schema = schemaToJsonSchema(schemaName, schemaDef, schemas);
            definitions[schemaName] = schema;
        }
        // Register each schema with definitions included
        for (const [schemaName, schemaDef] of Object.entries(schemas)) {
            const schema = schemaToJsonSchema(schemaName, schemaDef, schemas);
            // Add definitions to support $ref
            const schemaWithDefs = {
                ...schema,
                definitions
            };
            const validator = this.ajv.compile(schemaWithDefs);
            this.validators.set(schemaName, validator);
        }
    }
    /**
     * Validate data against a schema
     */
    validate(schemaName, data) {
        const validator = this.validators.get(schemaName);
        if (!validator) {
            return {
                valid: false,
                errorMessage: `Schema "${schemaName}" not found`
            };
        }
        const valid = validator(data);
        if (!valid) {
            return {
                valid: false,
                errors: validator.errors || []
            };
        }
        return { valid: true };
    }
    /**
     * Validate data against a JSON schema directly (without registering as a schema)
     */
    validateSchema(schema, data) {
        try {
            const validator = this.ajv.compile(schema);
            const valid = validator(data);
            if (!valid) {
                return {
                    valid: false,
                    errors: validator.errors || []
                };
            }
            return { valid: true };
        }
        catch (error) {
            return {
                valid: false,
                errorMessage: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Format validation errors into a readable message
     */
    formatErrors(errors) {
        return errors
            .map((error) => {
            const path = error.instancePath || error.schemaPath;
            const message = error.message;
            return `${path}: ${message}`;
        })
            .join(", ");
    }
}
/**
 * Create a new schema validator instance
 */
export function createSchemaValidator() {
    return new SchemaValidator();
}
//# sourceMappingURL=schemas.js.map