import { createSnapshot, saveSnapshot } from "./snapshots.js";
/**
 * Merge two schemas, detecting conflicts
 */
export function mergeSchemas(base, local, remote) {
    const conflicts = [];
    const merged = { ...base };
    // Get all entity names
    const allEntityNames = new Set([
        ...Object.keys(base),
        ...Object.keys(local),
        ...Object.keys(remote),
    ]);
    // Process each entity
    for (const entityName of allEntityNames) {
        const baseEntity = base[entityName];
        const localEntity = local[entityName];
        const remoteEntity = remote[entityName];
        // Entity removed in one branch
        if (!baseEntity) {
            // New entity in both branches - check for conflicts
            if (localEntity && remoteEntity) {
                const entityConflict = checkEntityConflict(entityName, localEntity, remoteEntity);
                if (entityConflict) {
                    conflicts.push(entityConflict);
                    continue;
                }
                // Merge fields from both
                merged[entityName] = mergeEntityFields(entityName, undefined, localEntity, remoteEntity, conflicts);
            }
            else if (localEntity) {
                merged[entityName] = localEntity;
            }
            else if (remoteEntity) {
                merged[entityName] = remoteEntity;
            }
            continue;
        }
        // Entity removed in local
        if (!localEntity && remoteEntity) {
            // Remote modified, local removed
            conflicts.push({
                type: "entity_removed_but_used",
                entity: entityName,
                description: `Entity ${entityName} was removed in local but modified in remote`,
                localChange: "removed",
                remoteChange: "modified",
            });
            continue;
        }
        // Entity removed in remote
        if (localEntity && !remoteEntity) {
            // Local modified, remote removed
            conflicts.push({
                type: "entity_removed_but_used",
                entity: entityName,
                description: `Entity ${entityName} was removed in remote but modified in local`,
                localChange: "modified",
                remoteChange: "removed",
            });
            continue;
        }
        // Both branches modified the entity
        if (localEntity && remoteEntity) {
            merged[entityName] = mergeEntityFields(entityName, baseEntity, localEntity, remoteEntity, conflicts);
        }
        else {
            // No changes or only one branch changed
            merged[entityName] = localEntity || remoteEntity || baseEntity;
        }
    }
    const canAutoMerge = conflicts.length === 0;
    return {
        success: canAutoMerge,
        merged: canAutoMerge ? merged : null,
        conflicts,
        canAutoMerge,
    };
}
/**
 * Merge fields from two entity definitions
 */
function mergeEntityFields(entityName, baseEntity, localEntity, remoteEntity, conflicts) {
    const merged = {
        table: localEntity.table || remoteEntity.table || entityName.toLowerCase(),
        fields: { ...(baseEntity?.fields || {}) },
    };
    // Get all field names
    const allFieldNames = new Set([
        ...Object.keys(baseEntity?.fields || {}),
        ...Object.keys(localEntity.fields || {}),
        ...Object.keys(remoteEntity.fields || {}),
    ]);
    // Merge fields
    for (const fieldName of allFieldNames) {
        const baseField = baseEntity?.fields?.[fieldName];
        const localField = localEntity.fields?.[fieldName];
        const remoteField = remoteEntity.fields?.[fieldName];
        // Field removed in one branch
        if (baseField && !localField && remoteField) {
            // Remote added/modified, local removed
            conflicts.push({
                type: "field_removed_but_used",
                entity: entityName,
                field: fieldName,
                description: `Field ${entityName}.${fieldName} was removed in local but modified in remote`,
                localChange: "removed",
                remoteChange: "modified",
            });
            continue;
        }
        if (baseField && localField && !remoteField) {
            // Local added/modified, remote removed
            conflicts.push({
                type: "field_removed_but_used",
                entity: entityName,
                field: fieldName,
                description: `Field ${entityName}.${fieldName} was removed in remote but modified in local`,
                localChange: "modified",
                remoteChange: "removed",
            });
            continue;
        }
        // Both branches modified the field
        if (localField && remoteField) {
            const fieldConflict = checkFieldConflict(entityName, fieldName, baseField, localField, remoteField);
            if (fieldConflict) {
                conflicts.push(fieldConflict);
                continue;
            }
            // Non-conflicting changes - prefer local (or merge intelligently)
            merged.fields[fieldName] = localField;
        }
        else if (localField) {
            merged.fields[fieldName] = localField;
        }
        else if (remoteField) {
            merged.fields[fieldName] = remoteField;
        }
        else if (baseField) {
            merged.fields[fieldName] = baseField;
        }
    }
    // Merge indexes
    if (localEntity.indexes || remoteEntity.indexes) {
        merged.indexes = [
            ...(localEntity.indexes || []),
            ...(remoteEntity.indexes || []),
        ];
    }
    // Merge relations
    if (localEntity.relations || remoteEntity.relations) {
        merged.relations = {
            ...(localEntity.relations || {}),
            ...(remoteEntity.relations || {}),
        };
    }
    return merged;
}
/**
 * Check for conflicts between two entity definitions
 */
function checkEntityConflict(entityName, localEntity, remoteEntity) {
    // Check if table names conflict
    if (localEntity.table !== remoteEntity.table) {
        return {
            type: "ambiguous_change",
            entity: entityName,
            description: `Entity ${entityName} has different table names: ${localEntity.table} vs ${remoteEntity.table}`,
            localChange: `table: ${localEntity.table}`,
            remoteChange: `table: ${remoteEntity.table}`,
        };
    }
    return null;
}
/**
 * Check for conflicts between two field definitions
 */
function checkFieldConflict(entityName, fieldName, baseField, localField, remoteField) {
    // Type mismatch
    if (localField.type !== remoteField.type) {
        return {
            type: "field_type_mismatch",
            entity: entityName,
            field: fieldName,
            description: `Field ${entityName}.${fieldName} has type mismatch: ${localField.type} vs ${remoteField.type}`,
            localChange: `type: ${localField.type}`,
            remoteChange: `type: ${remoteField.type}`,
        };
    }
    // Required/nullable mismatch
    const localRequired = localField.required || !localField.nullable;
    const remoteRequired = remoteField.required || !remoteField.nullable;
    if (localRequired !== remoteRequired) {
        return {
            type: "field_required_mismatch",
            entity: entityName,
            field: fieldName,
            description: `Field ${entityName}.${fieldName} has required mismatch: ${localRequired} vs ${remoteRequired}`,
            localChange: `required: ${localRequired}`,
            remoteChange: `required: ${remoteRequired}`,
        };
    }
    return null;
}
/**
 * Detect conflicts between two schemas
 */
export function detectConflicts(base, local, remote) {
    const result = mergeSchemas(base, local, remote);
    return result.conflicts;
}
/**
 * Check if schemas can be auto-merged
 */
export function canAutoMerge(base, local, remote) {
    const result = mergeSchemas(base, local, remote);
    return result.canAutoMerge;
}
/**
 * Create a merge snapshot
 */
export function createMergeSnapshot(configDir, baseHash, localHash, remoteHash, merged, metadata) {
    const snapshot = createSnapshot(merged, {
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        description: metadata.description || `Merge of ${localHash.substring(0, 8)} and ${remoteHash.substring(0, 8)}`,
    }, baseHash);
    // Note: parentHash is set to baseHash, but we track both parents in metadata
    saveSnapshot(configDir, snapshot);
    return snapshot;
}
//# sourceMappingURL=merge.js.map