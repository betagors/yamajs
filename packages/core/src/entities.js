/**
 * Parse shorthand field syntax (e.g., "string!", "string?", "enum[user, admin]")
 * Also supports inline relations (e.g., "User!", "Post[]", "Tag[] through:post_tags")
 * and inline constraints (e.g., "string! unique", "string! indexed")
 * Optimized parser - assumes shorthand syntax by default
 */
export function parseFieldDefinition(fieldName, fieldDef, availableEntities) {
    // Fast path: already parsed
    if (typeof fieldDef !== "string") {
        return fieldDef;
    }
    const field = { type: "string" };
    const str = fieldDef.trim();
    // Parse enum syntax: enum[value1, value2, ...]
    const enumMatch = str.match(/^enum\[(.+)\]$/);
    if (enumMatch) {
        const enumValues = enumMatch[1]
            .split(",")
            .map((v) => v.trim().replace(/^["']|["']$/g, ""));
        field.type = "string";
        field.enum = enumValues;
        return field;
    }
    // Check for inline constraints and relation config
    const parts = str.split(/\s+/);
    let baseTypeStr = parts[0];
    const constraints = [];
    const relationConfig = {};
    // Parse constraints and config from remaining parts
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part === "unique") {
            constraints.push("unique");
        }
        else if (part === "indexed" || part === "index") {
            constraints.push("indexed");
        }
        else if (part === "cascade") {
            relationConfig.cascade = true;
        }
        else if (part.startsWith("through:")) {
            relationConfig.through = part.substring(8);
        }
        else if (part === "timestamps:true" || part === "timestamps") {
            relationConfig.timestamps = true;
        }
    }
    // Apply constraints
    if (constraints.includes("unique")) {
        field.unique = true;
    }
    if (constraints.includes("indexed")) {
        field.index = true;
    }
    // Parse type with modifiers: type! (required), type? (nullable)
    let typeStr = baseTypeStr;
    let required = false;
    let nullable = false;
    let isArray = false;
    // Check for array syntax: Entity[]
    if (typeStr.endsWith("[]")) {
        isArray = true;
        typeStr = typeStr.slice(0, -2);
    }
    if (typeStr.endsWith("!")) {
        required = true;
        nullable = false;
        typeStr = typeStr.slice(0, -1);
    }
    else if (typeStr.endsWith("?")) {
        required = false;
        nullable = true;
        typeStr = typeStr.slice(0, -1);
    }
    // Check if this is an entity reference (capitalized name)
    // Entity names typically start with uppercase letter
    const isEntityReference = /^[A-Z][a-zA-Z0-9]*$/.test(typeStr) &&
        (availableEntities?.has(typeStr) ?? true); // If we have entity list, check it; otherwise assume it's an entity
    if (isEntityReference) {
        // This is an inline relation
        field._isInlineRelation = true;
        // Determine relation type based on syntax
        let relationType;
        if (isArray) {
            // Could be hasMany or manyToMany - default to manyToMany if through is specified, otherwise hasMany
            relationType = relationConfig.through ? "manyToMany" : "hasMany";
        }
        else if (nullable && !required) {
            // Single nullable entity reference - likely hasOne
            relationType = "hasOne";
        }
        else {
            // Single required entity reference - belongsTo
            relationType = "belongsTo";
        }
        field._inlineRelation = {
            entity: typeStr,
            relationType,
            ...(relationConfig.cascade && { cascade: true }),
            ...(relationConfig.through && { through: relationConfig.through }),
            ...(relationConfig.timestamps && { timestamps: true }),
        };
        // Return early - this is a relation, not a field
        return field;
    }
    // Parse default value: type = value
    const defaultMatch = typeStr.match(/^(.+?)\s*=\s*(.+)$/);
    if (defaultMatch) {
        typeStr = defaultMatch[1].trim();
        const defaultValue = defaultMatch[2].trim();
        // Try to parse default value
        if (defaultValue === "true" || defaultValue === "false") {
            field.default = defaultValue === "true";
        }
        else if (defaultValue === "now" || defaultValue === "now()") {
            field.default = "now()";
        }
        else if (!isNaN(Number(defaultValue)) && defaultValue !== "") {
            field.default = Number(defaultValue);
        }
        else {
            // Remove quotes if present
            field.default = defaultValue.replace(/^["']|["']$/g, "");
        }
    }
    // Map type string to EntityFieldType
    const typeMap = {
        string: "string",
        text: "text",
        uuid: "uuid",
        number: "number",
        integer: "integer",
        boolean: "boolean",
        timestamp: "timestamp",
        jsonb: "jsonb",
    };
    field.type = typeMap[typeStr.toLowerCase()] || "string";
    field.required = required;
    field.nullable = nullable;
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
 */
export function normalizeEntityDefinition(entityName, entityDef, allEntities) {
    // Build normalized structure - only copy what we need
    const normalized = {
        table: entityDef.table,
        indexes: entityDef.indexes,
        apiSchema: entityDef.apiSchema,
        crud: entityDef.crud,
        validations: entityDef.validations,
        computed: entityDef.computed,
        hooks: entityDef.hooks,
        softDelete: entityDef.softDelete,
        fields: {},
    };
    // Build set of available entity names for validation
    const availableEntities = allEntities && typeof allEntities === 'object' && allEntities !== null
        ? new Set(Object.keys(allEntities))
        : undefined;
    // Parse fields and extract inline relations
    if (!entityDef.fields || typeof entityDef.fields !== 'object' || entityDef.fields === null) {
        return normalized;
    }
    const fieldEntries = Object.entries(entityDef.fields);
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
                if (!entityDef.fields[foreignKeyName]) {
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
    switch (entityType) {
        case "uuid":
        case "string":
        case "text":
            return "string";
        case "number":
        case "integer":
            return "number";
        case "boolean":
            return "boolean";
        case "timestamp":
            return "string";
        case "jsonb":
            return "object";
        default:
            return "string";
    }
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
    // Add format for timestamps
    if (entityField.type === "timestamp") {
        schemaField.format = entityField.apiFormat || "date-time";
    }
    // Add validation rules
    if (entityField.minLength !== undefined) {
        schemaField.min = entityField.minLength;
    }
    if (entityField.maxLength !== undefined) {
        schemaField.max = entityField.maxLength;
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
 * Convert all entities to schemas - optimized batch processing
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