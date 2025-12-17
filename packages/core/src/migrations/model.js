import { normalizeEntityDefinition } from "../entities.js";
import { DatabaseTypeMapper } from "../types/index.js";
import { sha256Hex } from "../platform/hash.js";
/**
 * Normalize entities to a canonical JSON representation
 * This ensures consistent hashing regardless of field order
 */
function normalizeEntities(entities) {
    const normalized = {};
    // Sort entity names for consistency
    const sortedEntityNames = Object.keys(entities).sort();
    for (const entityName of sortedEntityNames) {
        const entity = entities[entityName];
        // Use same fallback logic as normalizeEntityDefinition
        const dbConfig = typeof entity.database === "string"
            ? { table: entity.database }
            : entity.database;
        const tableName = dbConfig?.table || entity.table || entityName.toLowerCase() + 's';
        const normalizedEntity = {
            table: tableName,
            fields: {},
        };
        // Sort field names for consistency
        if (!entity.fields) {
            // Entity has no fields - add it with empty fields and continue
            normalized[entityName] = normalizedEntity;
            continue;
        }
        const sortedFieldNames = Object.keys(entity.fields).sort();
        for (const fieldName of sortedFieldNames) {
            const field = entity.fields[fieldName];
            // Normalize field by sorting keys and removing undefined values
            const normalizedField = {};
            const fieldKeys = Object.keys(field).sort();
            for (const key of fieldKeys) {
                const value = field[key];
                if (value !== undefined) {
                    normalizedField[key] = value;
                }
            }
            normalizedEntity.fields[fieldName] = normalizedField;
        }
        // Add indexes if present
        if (entity.indexes && entity.indexes.length > 0) {
            normalizedEntity.indexes = entity.indexes
                .map((idx) => ({
                name: idx.name,
                fields: [...idx.fields].sort(),
                unique: idx.unique || false,
            }))
                .sort((a, b) => (a.name || a.fields.join(",")).localeCompare(b.name || b.fields.join(",")));
        }
        normalized[entityName] = normalizedEntity;
    }
    return JSON.stringify(normalized, null, 0);
}
/**
 * Compute SHA-256 hash of entities
 */
export function computeModelHash(entities) {
    const normalized = normalizeEntities(entities);
    return sha256Hex(normalized);
}
/**
 * Convert entities to Model representation
 */
export function entitiesToModel(entities) {
    const hash = computeModelHash(entities);
    const tables = new Map();
    // Process entities efficiently
    const entityEntries = Object.entries(entities);
    for (let i = 0; i < entityEntries.length; i++) {
        const [entityName, entityDef] = entityEntries[i];
        const columns = new Map();
        // Normalize once per entity
        const normalized = normalizeEntityDefinition(entityName, entityDef, entities);
        // normalized.table is always defined (has fallback in normalizeEntityDefinition)
        const tableName = normalized.table || entityName.toLowerCase() + 's';
        const fieldEntries = Object.entries(normalized.fields);
        // Process fields efficiently
        for (let j = 0; j < fieldEntries.length; j++) {
            const [fieldName, field] = fieldEntries[j];
            const dbColumnName = field.dbColumn || fieldName;
            // Convert entity type to SQL type using new type system
            let sqlType = field.dbType || "";
            if (!sqlType) {
                // Convert EntityField to FieldType for DatabaseTypeMapper
                const fieldType = {
                    type: field.type,
                    nullable: field.nullable !== false && !field.required,
                    array: false,
                    length: field.length,
                    maxLength: field.maxLength,
                    minLength: field.minLength,
                    precision: field.precision,
                    scale: field.scale,
                    currency: field.currency,
                    enumValues: field.enum,
                    pattern: field.pattern,
                };
                // Use DatabaseTypeMapper for PostgreSQL (default)
                sqlType = DatabaseTypeMapper.toPostgreSQL(fieldType);
            }
            // Primary keys are always NOT NULL
            const isPrimary = field.primary || false;
            const nullable = isPrimary ? false : (field.nullable !== false && !field.required);
            columns.set(dbColumnName, {
                name: dbColumnName,
                type: sqlType,
                nullable: nullable,
                primary: isPrimary,
                default: field.default,
                generated: field.generated,
            });
        }
        const indexes = [];
        // Add indexes from entity definition - optimized
        if (normalized.indexes) {
            for (let k = 0; k < normalized.indexes.length; k++) {
                const index = normalized.indexes[k];
                const indexColumns = [];
                for (let m = 0; m < index.fields.length; m++) {
                    const f = index.fields[m];
                    const field = normalized.fields[f];
                    indexColumns.push(field?.dbColumn || f);
                }
                indexes.push({
                    name: index.name || `${tableName}_${index.fields.join("_")}_idx`,
                    columns: indexColumns,
                    unique: index.unique || false,
                });
            }
        }
        // Add indexes from field index: true - optimized loop
        for (let k = 0; k < fieldEntries.length; k++) {
            const [fieldName, field] = fieldEntries[k];
            if (field.index) {
                const dbColumnName = field.dbColumn || fieldName;
                indexes.push({
                    name: `${tableName}_${dbColumnName}_idx`,
                    columns: [dbColumnName],
                    unique: false,
                });
            }
        }
        tables.set(tableName, {
            name: tableName,
            columns,
            indexes,
            foreignKeys: [], // Foreign keys not yet supported in entity definitions
        });
    }
    return {
        hash,
        entities,
        tables,
    };
}
export function compareModels(from, to) {
    return {
        fromHash: from.hash,
        toHash: to.hash,
        hasChanges: from.hash !== to.hash,
    };
}
//# sourceMappingURL=model.js.map