/**
 * Compare two models and compute the diff
 */
export function computeDiff(from, to) {
    const result = {
        added: {
            tables: [],
            columns: [],
            indexes: [],
            foreignKeys: [],
        },
        removed: {
            tables: [],
            columns: [],
            indexes: [],
            foreignKeys: [],
        },
        modified: {
            tables: [],
            columns: [],
        },
    };
    const fromTables = new Set(from.tables.keys());
    const toTables = new Set(to.tables.keys());
    // Find added tables
    for (const tableName of toTables) {
        if (!fromTables.has(tableName)) {
            result.added.tables.push(tableName);
        }
    }
    // Find removed tables
    for (const tableName of fromTables) {
        if (!toTables.has(tableName)) {
            result.removed.tables.push(tableName);
        }
    }
    // Compare tables that exist in both
    for (const tableName of fromTables) {
        if (toTables.has(tableName)) {
            const fromTable = from.tables.get(tableName);
            const toTable = to.tables.get(tableName);
            // Compare columns
            const fromColumns = new Set(fromTable.columns.keys());
            const toColumns = new Set(toTable.columns.keys());
            // Added columns
            for (const columnName of toColumns) {
                if (!fromColumns.has(columnName)) {
                    result.added.columns.push({ table: tableName, column: columnName });
                }
            }
            // Removed columns
            for (const columnName of fromColumns) {
                if (!toColumns.has(columnName)) {
                    result.removed.columns.push({ table: tableName, column: columnName });
                }
            }
            // Modified columns
            for (const columnName of fromColumns) {
                if (toColumns.has(columnName)) {
                    const fromCol = fromTable.columns.get(columnName);
                    const toCol = toTable.columns.get(columnName);
                    const changes = [];
                    if (fromCol.type !== toCol.type) {
                        changes.push(`type: ${fromCol.type} → ${toCol.type}`);
                    }
                    if (fromCol.nullable !== toCol.nullable) {
                        changes.push(`nullable: ${fromCol.nullable} → ${toCol.nullable}`);
                    }
                    if (fromCol.default !== toCol.default) {
                        changes.push(`default: ${JSON.stringify(fromCol.default)} → ${JSON.stringify(toCol.default)}`);
                    }
                    if (changes.length > 0) {
                        result.modified.columns.push({
                            table: tableName,
                            column: columnName,
                            changes,
                        });
                    }
                }
            }
            // Compare indexes
            const fromIndexMap = new Map(fromTable.indexes.map((idx) => [idx.name, idx]));
            const toIndexMap = new Map(toTable.indexes.map((idx) => [idx.name, idx]));
            // Added indexes
            for (const [indexName, index] of toIndexMap) {
                if (!fromIndexMap.has(indexName)) {
                    result.added.indexes.push({ table: tableName, index: indexName });
                }
            }
            // Removed indexes
            for (const [indexName, index] of fromIndexMap) {
                if (!toIndexMap.has(indexName)) {
                    result.removed.indexes.push({ table: tableName, index: indexName });
                }
            }
            // Also detect indexes that should be removed because their columns are being removed
            // Check if any index columns are in the removed columns list
            for (const [indexName, index] of fromIndexMap) {
                // If index is on a column that's being removed, mark it for removal
                const hasRemovedColumn = index.columns.some((col) => {
                    return result.removed.columns.some((removed) => removed.table === tableName && removed.column === col);
                });
                // Only add if not already in removed list
                if (hasRemovedColumn && !result.removed.indexes.some(r => r.table === tableName && r.index === indexName)) {
                    result.removed.indexes.push({ table: tableName, index: indexName });
                }
            }
            // Compare foreign keys
            const fromFKMap = new Map(fromTable.foreignKeys.map((fk) => [fk.name, fk]));
            const toFKMap = new Map(toTable.foreignKeys.map((fk) => [fk.name, fk]));
            // Added foreign keys
            for (const [fkName] of toFKMap) {
                if (!fromFKMap.has(fkName)) {
                    result.added.foreignKeys.push({ table: tableName, fk: fkName });
                }
            }
            // Removed foreign keys
            for (const [fkName] of fromFKMap) {
                if (!toFKMap.has(fkName)) {
                    result.removed.foreignKeys.push({ table: tableName, fk: fkName });
                }
            }
        }
    }
    return result;
}
/**
 * Convert diff result to migration steps
 */
export function diffToSteps(diff, from, to) {
    const steps = [];
    // Add tables first
    for (const tableName of diff.added.tables) {
        const table = to.tables.get(tableName);
        steps.push({
            type: "add_table",
            table: tableName,
            columns: Array.from(table.columns.values()).map((col) => ({
                name: col.name,
                type: col.type,
                nullable: col.nullable,
                primary: col.primary,
                default: col.default,
                generated: col.generated,
            })),
        });
    }
    // Add columns to existing tables
    for (const { table: tableName, column: columnName } of diff.added.columns) {
        const table = to.tables.get(tableName);
        const column = table.columns.get(columnName);
        steps.push({
            type: "add_column",
            table: tableName,
            column: {
                name: column.name,
                type: column.type,
                nullable: column.nullable,
                default: column.default,
                generated: column.generated,
            },
        });
    }
    // Modify columns
    for (const { table: tableName, column: columnName, changes } of diff.modified.columns) {
        const toTable = to.tables.get(tableName);
        const toColumn = toTable.columns.get(columnName);
        const fromTable = from.tables.get(tableName);
        const fromColumn = fromTable.columns.get(columnName);
        const stepChanges = {};
        if (fromColumn.type !== toColumn.type) {
            stepChanges.type = toColumn.type;
        }
        if (fromColumn.nullable !== toColumn.nullable) {
            stepChanges.nullable = toColumn.nullable;
        }
        if (fromColumn.default !== toColumn.default) {
            stepChanges.default = toColumn.default;
        }
        if (Object.keys(stepChanges).length > 0) {
            steps.push({
                type: "modify_column",
                table: tableName,
                column: columnName,
                changes: stepChanges,
            });
        }
    }
    // Add indexes
    for (const { table: tableName, index: indexName } of diff.added.indexes) {
        const table = to.tables.get(tableName);
        const index = table.indexes.find((idx) => idx.name === indexName);
        steps.push({
            type: "add_index",
            table: tableName,
            index: {
                name: index.name,
                columns: index.columns,
                unique: index.unique,
            },
        });
    }
    // Add foreign keys
    for (const { table: tableName, fk: fkName } of diff.added.foreignKeys) {
        const table = to.tables.get(tableName);
        const fk = table.foreignKeys.find((key) => key.name === fkName);
        steps.push({
            type: "add_foreign_key",
            table: tableName,
            foreignKey: {
                name: fk.name,
                columns: fk.columns,
                references: fk.references,
            },
        });
    }
    // Drop foreign keys
    for (const { table: tableName, fk: fkName } of diff.removed.foreignKeys) {
        steps.push({
            type: "drop_foreign_key",
            table: tableName,
            foreignKey: fkName,
        });
    }
    // Drop indexes
    for (const { table: tableName, index: indexName } of diff.removed.indexes) {
        steps.push({
            type: "drop_index",
            table: tableName,
            index: indexName,
        });
    }
    // Drop columns
    for (const { table: tableName, column: columnName } of diff.removed.columns) {
        steps.push({
            type: "drop_column",
            table: tableName,
            column: columnName,
        });
    }
    // Drop tables last
    for (const tableName of diff.removed.tables) {
        steps.push({
            type: "drop_table",
            table: tableName,
        });
    }
    return steps;
}
//# sourceMappingURL=diff.js.map