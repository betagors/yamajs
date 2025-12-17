import { TypeParser } from "./types/index.js";
import { normalizeConfig } from "./config-normalizer.js";
/**
 * Parse field definition using new type system
 * Supports inline relations (e.g., "User!", "Post[]", "Tag[] through:post_tags")
 * Uses TypeParser for all type parsing
 */
export function parseFieldDefinition(fieldName, fieldDef, availableEntities) {
    // Fast path: already parsed
    if (typeof fieldDef !== "string") {
        // Handle inline nested type (object with fields property)
        if (typeof fieldDef === "object" && fieldDef !== null && !Array.isArray(fieldDef) && "fields" in fieldDef) {
            // This is an inline nested type - mark it as such
            return {
                type: "object",
                _isInlineNestedType: true,
                _inlineNestedFields: fieldDef.fields,
            };
        }
        // If it's an object, convert using TypeParser
        if (typeof fieldDef === "object" && fieldDef !== null && !Array.isArray(fieldDef)) {
            const parsedType = TypeParser.parseExpanded(fieldDef);
            return {
                type: parsedType.type,
                required: !parsedType.nullable,
                nullable: parsedType.nullable,
                unique: parsedType.unique,
                index: parsedType.indexed,
                generated: parsedType.generated,
                default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
                minLength: parsedType.minLength,
                maxLength: parsedType.maxLength,
                min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
                max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
                pattern: parsedType.pattern,
                enum: parsedType.enumValues,
                precision: parsedType.precision,
                scale: parsedType.scale,
                currency: parsedType.currency,
                length: parsedType.length,
                readonly: parsedType.readonly,
                writeOnly: parsedType.writeOnly,
                sensitive: parsedType.sensitive,
                autoUpdate: parsedType.autoUpdate,
            };
        }
        return fieldDef;
    }
    const str = fieldDef.trim();
    // Extract relation config (through:, cascade, timestamps)
    const relationConfig = {};
    const parts = str.split(/\s+/);
    let typeStr = parts[0];
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part === "cascade") {
            relationConfig.cascade = true;
        }
        else if (part.startsWith("through:")) {
            relationConfig.through = part.substring(8);
        }
        else if (part === "timestamps:true" || part === "timestamps") {
            relationConfig.timestamps = true;
        }
    }
    // Check if this is an entity reference (capitalized name)
    // Remove array and required/optional markers for entity check
    let entityCheckStr = typeStr;
    if (entityCheckStr.endsWith("[]")) {
        entityCheckStr = entityCheckStr.slice(0, -2);
    }
    if (entityCheckStr.endsWith("!") || entityCheckStr.endsWith("?")) {
        entityCheckStr = entityCheckStr.slice(0, -1);
    }
    const isEntityReference = /^[A-Z][a-zA-Z0-9]*$/.test(entityCheckStr) &&
        (availableEntities?.has(entityCheckStr) ?? true);
    if (isEntityReference) {
        // This is an inline relation - extract relation info from string
        // Parse just enough to get array/nullable info
        const hasArray = str.includes("[]");
        const isRequired = str.endsWith("!") || (!str.endsWith("?") && !str.includes("?"));
        const isNullable = str.endsWith("?") || (!isRequired);
        const field = {
            type: "string",
            _isInlineRelation: true,
        };
        // Determine relation type based on syntax
        let relationType;
        if (hasArray) {
            relationType = relationConfig.through ? "manyToMany" : "hasMany";
        }
        else if (isNullable && !isRequired) {
            relationType = "hasOne";
        }
        else {
            relationType = "belongsTo";
        }
        field._inlineRelation = {
            entity: entityCheckStr,
            relationType,
            ...(relationConfig.cascade && { cascade: true }),
            ...(relationConfig.through && { through: relationConfig.through }),
            ...(relationConfig.timestamps && { timestamps: true }),
        };
        return field;
    }
    // Use TypeParser for all type parsing
    const parsedType = TypeParser.parse(str);
    // Convert FieldType to EntityField
    const field = {
        type: parsedType.type,
        required: !parsedType.nullable,
        nullable: parsedType.nullable,
        unique: parsedType.unique,
        index: parsedType.indexed,
        generated: parsedType.generated,
        default: parsedType.default || (parsedType.defaultFn ? parsedType.defaultFn + "()" : undefined),
        minLength: parsedType.minLength,
        maxLength: parsedType.maxLength,
        min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
        max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
        pattern: parsedType.pattern,
        enum: parsedType.enumValues,
    };
    // Copy precision/scale for decimal types
    if (parsedType.precision !== undefined) {
        field.precision = parsedType.precision;
    }
    if (parsedType.scale !== undefined) {
        field.scale = parsedType.scale;
    }
    if (parsedType.currency) {
        field.currency = parsedType.currency;
    }
    if (parsedType.length) {
        field.length = parsedType.length;
    }
    return field;
}
/**
 * Parse relation shorthand syntax - optimized for shorthand-first approach
 */
export function parseRelationDefinition(relationDef) {
    // Fast path: already parsed
    if (typeof relationDef !== "string") {
        return relationDef;
    }
    // Optimized regex for common patterns
    const match = relationDef.match(/^(hasMany|belongsTo|hasOne|manyToMany)\((.+)\)$/);
    if (!match) {
        throw new Error(`Invalid relation syntax: ${relationDef}. Use: hasMany(Entity), belongsTo(Entity), hasOne(Entity), or manyToMany(Entity)`);
    }
    return {
        type: match[1],
        entity: match[2].trim(),
    };
}
/**
 * Normalize entity definition - optimized parser for shorthand-first syntax
 * Parses fields and relations on-demand, caching results
 * Extracts inline relations from fields and auto-generates foreign keys
 * Handles source inheritance and include filtering
 */
export function normalizeEntityDefinition(entityName, entityDef, allEntities) {
    // Handle database shorthand (string)
    const dbConfig = typeof entityDef.database === "string"
        ? { table: entityDef.database }
        : entityDef.database;
    // Build normalized structure - only copy what we need
    const normalized = {
        table: dbConfig?.table || entityDef.table || entityName.toLowerCase() + 's',
        indexes: entityDef.indexes || dbConfig?.indexes,
        apiSchema: entityDef.apiSchema,
        crud: entityDef.crud,
        validations: entityDef.validations,
        computed: entityDef.computed,
        variants: entityDef.variants,
        hooks: entityDef.hooks,
        softDelete: entityDef.softDelete,
        source: entityDef.source,
        include: entityDef.include,
        fields: {},
    };
    // Build set of available entity names for validation
    const availableEntities = allEntities && typeof allEntities === 'object' && allEntities !== null
        ? new Set(Object.keys(allEntities))
        : undefined;
    // Handle source inheritance
    let baseFields = {};
    if (entityDef.source && allEntities) {
        const sourceEntity = allEntities[entityDef.source];
        if (sourceEntity) {
            // Normalize source entity to get its fields
            const normalizedSource = normalizeEntityDefinition(entityDef.source, sourceEntity, allEntities);
            // If include is specified, only include those fields
            if (entityDef.include && Array.isArray(entityDef.include)) {
                for (const fieldName of entityDef.include) {
                    if (normalizedSource.fields[fieldName]) {
                        // Convert EntityField back to EntityFieldDefinition for merging
                        // This is a simplified conversion - in practice, we'd need to preserve the original definition
                        baseFields[fieldName] = normalizedSource.fields[fieldName];
                    }
                }
            }
            else {
                // Include all fields from source
                for (const [fieldName, field] of Object.entries(normalizedSource.fields)) {
                    baseFields[fieldName] = field;
                }
            }
        }
    }
    // Merge base fields with entity's own fields (entity fields override source fields)
    const mergedFields = {
        ...baseFields,
        ...(entityDef.fields || {}),
    };
    // Parse fields and extract inline relations
    if (Object.keys(mergedFields).length === 0) {
        return normalized;
    }
    const fieldEntries = Object.entries(mergedFields);
    const inlineRelations = {};
    for (let i = 0; i < fieldEntries.length; i++) {
        const [fieldName, fieldDef] = fieldEntries[i];
        const parsedField = parseFieldDefinition(fieldName, fieldDef, availableEntities);
        // Check if this is an inline relation
        if (parsedField._isInlineRelation && parsedField._inlineRelation) {
            const inlineRel = parsedField._inlineRelation;
            // Convert inline relation to normalized relation format
            const normalizedRelation = {
                type: inlineRel.relationType,
                entity: inlineRel.entity,
            };
            // Add relation-specific config
            if (inlineRel.through) {
                normalizedRelation.through = inlineRel.through;
            }
            if (inlineRel.cascade && inlineRel.relationType === "belongsTo") {
                // For belongsTo, cascade means onDelete: cascade
                normalizedRelation.onDelete = "cascade";
            }
            // Auto-generate foreign key for belongsTo relations
            if (inlineRel.relationType === "belongsTo") {
                const foreignKeyName = `${fieldName}Id`;
                // Only auto-generate if foreign key doesn't already exist
                if (!entityDef.fields || !entityDef.fields[foreignKeyName]) {
                    normalized.fields[foreignKeyName] = {
                        type: "uuid",
                        required: !parsedField.nullable,
                        nullable: parsedField.nullable,
                        index: true, // Auto-index foreign keys
                    };
                    normalizedRelation.foreignKey = foreignKeyName;
                }
                else {
                    // Foreign key exists, use it
                    const fkField = parseFieldDefinition(foreignKeyName, entityDef.fields[foreignKeyName], availableEntities);
                    normalized.fields[foreignKeyName] = fkField;
                    normalizedRelation.foreignKey = foreignKeyName;
                }
            }
            // Store inline relation
            inlineRelations[fieldName] = normalizedRelation;
        }
        else {
            // Regular field
            normalized.fields[fieldName] = parsedField;
        }
    }
    // Parse explicit relations if present
    const explicitRelations = {};
    if (entityDef.relations && typeof entityDef.relations === 'object' && entityDef.relations !== null) {
        const relationEntries = Object.entries(entityDef.relations);
        for (let i = 0; i < relationEntries.length; i++) {
            const [relationName, relationDef] = relationEntries[i];
            explicitRelations[relationName] = parseRelationDefinition(relationDef);
        }
    }
    // Merge relations: explicit takes precedence over inline
    if (Object.keys(inlineRelations).length > 0 || Object.keys(explicitRelations).length > 0) {
        normalized.relations = {
            ...inlineRelations,
            ...explicitRelations, // Explicit relations override inline ones
        };
    }
    return normalized;
}
/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
/**
 * Convert entity field type to schema field type
 */
function entityTypeToSchemaType(entityType) {
    // Map all new types to JSON Schema types
    if (entityType === "uuid" || entityType === "string" || entityType === "text" ||
        entityType === "email" || entityType === "url" || entityType === "phone" ||
        entityType === "slug" || entityType === "base64") {
        return "string";
    }
    if (entityType === "number" || entityType === "decimal" || entityType === "money" ||
        entityType === "float" || entityType === "double") {
        return "number";
    }
    if (entityType === "integer" || entityType === "int" || entityType === "int8" ||
        entityType === "int16" || entityType === "int32" || entityType === "int64" ||
        entityType === "bigint" || entityType === "uint") {
        return "integer";
    }
    if (entityType === "boolean") {
        return "boolean";
    }
    if (entityType === "timestamp" || entityType === "timestamptz" ||
        entityType === "timestamplocal" || entityType === "datetime" ||
        entityType === "datetimetz" || entityType === "datetimelocal" ||
        entityType === "date" || entityType === "time" || entityType === "interval" ||
        entityType === "duration") {
        return "string";
    }
    if (entityType === "json" || entityType === "jsonb") {
        return "object";
    }
    if (entityType === "enum") {
        return "string";
    }
    if (entityType === "binary") {
        return "string"; // Base64 encoded
    }
    return "string";
}
/**
 * Convert entity field to schema field
 */
function entityFieldToSchemaField(fieldName, entityField) {
    // Exclude if api is explicitly false
    if (entityField.api === false) {
        return null;
    }
    // Determine API field name
    const apiFieldName = entityField.api && typeof entityField.api === "string"
        ? entityField.api
        : entityField.dbColumn
            ? snakeToCamel(entityField.dbColumn)
            : fieldName;
    // Convert entity type to schema type
    const schemaType = entityTypeToSchemaType(entityField.type);
    const schemaField = {
        type: schemaType,
        required: entityField.required,
    };
    // Add format for date/time types
    if (entityField.type === "timestamp" || entityField.type === "timestamptz" ||
        entityField.type === "timestamplocal" || entityField.type === "datetime" ||
        entityField.type === "datetimetz" || entityField.type === "datetimelocal") {
        schemaField.format = entityField.apiFormat || "date-time";
    }
    else if (entityField.type === "date") {
        schemaField.format = "date";
    }
    else if (entityField.type === "time") {
        schemaField.format = "time";
    }
    else if (entityField.type === "email") {
        schemaField.format = "email";
    }
    else if (entityField.type === "url") {
        schemaField.format = "uri";
    }
    // Add validation rules
    if (entityField.minLength !== undefined) {
        schemaField.minLength = entityField.minLength;
    }
    if (entityField.maxLength !== undefined) {
        schemaField.maxLength = entityField.maxLength;
    }
    if (entityField.min !== undefined) {
        schemaField.min = entityField.min;
    }
    if (entityField.max !== undefined) {
        schemaField.max = entityField.max;
    }
    if (entityField.pattern) {
        schemaField.pattern = entityField.pattern;
    }
    if (entityField.enum) {
        schemaField.enum = entityField.enum;
    }
    // Add default if specified
    if (entityField.default !== undefined) {
        schemaField.default = entityField.default;
    }
    return { apiFieldName, schemaField };
}
/**
 * Convert entity definition to API schema definition
 * Optimized - normalizes once and processes fields efficiently
 */
export function entityToSchema(entityName, entityDef, entities) {
    // Normalize once - all fields become EntityField objects
    const normalized = normalizeEntityDefinition(entityName, entityDef, entities);
    const schemaFields = {};
    if (!normalized.fields || typeof normalized.fields !== 'object' || normalized.fields === null) {
        return { fields: schemaFields };
    }
    const fieldEntries = Object.entries(normalized.fields);
    // Process fields - optimized loop
    for (let i = 0; i < fieldEntries.length; i++) {
        const [fieldName, entityField] = fieldEntries[i];
        // Skip inline relations - they're handled via foreign keys, not as direct fields
        if (entityField._isInlineRelation) {
            continue;
        }
        const result = entityFieldToSchemaField(fieldName, entityField);
        if (result) {
            schemaFields[result.apiFieldName] = result.schemaField;
        }
    }
    // Computed fields are runtime-only, not in schema
    // They would be resolved dynamically when fetching entities
    return { fields: schemaFields };
}
/**
 * Normalize config to use schemas (unified entities/schemas)
 * Uses config-normalizer for unified handling
 */
export function normalizeSchemas(config) {
    const normalized = normalizeConfig(config);
    return normalized.schemas;
}
/**
 * Convert entities to API schemas (SchemaDefinition format for validation)
 * This converts EntityDefinition to SchemaDefinition format
 */
export function entitiesToSchemas(entities) {
    const schemas = {};
    if (!entities || typeof entities !== 'object' || entities === null) {
        return schemas;
    }
    const entityEntries = Object.entries(entities);
    // Process all entities in one pass
    for (let i = 0; i < entityEntries.length; i++) {
        const [entityName, entityDef] = entityEntries[i];
        const schemaName = entityDef.apiSchema || entityName;
        schemas[schemaName] = entityToSchema(entityName, entityDef, entities);
    }
    return schemas;
}
/**
 * Merge entity-generated schemas with explicit schemas
 * Explicit schemas take precedence
 */
export function mergeSchemas(explicitSchemas, entitySchemas) {
    // Handle null or undefined explicitSchemas
    if (!explicitSchemas || typeof explicitSchemas !== 'object' || explicitSchemas === null) {
        return entitySchemas && typeof entitySchemas === 'object' && entitySchemas !== null ? entitySchemas : {};
    }
    // Ensure entitySchemas is an object before spreading
    const normalizedEntitySchemas = entitySchemas && typeof entitySchemas === 'object' && entitySchemas !== null ? entitySchemas : {};
    // Start with entity schemas, then override with explicit schemas
    return {
        ...normalizedEntitySchemas,
        ...explicitSchemas,
    };
}
//# sourceMappingURL=entities.js.map