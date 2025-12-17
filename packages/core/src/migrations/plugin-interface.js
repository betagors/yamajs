import { sha256Hex } from "../platform/hash.js";
/**
 * Default capabilities (most databases support these)
 */
export const DEFAULT_CAPABILITIES = {
    addTable: true,
    dropTable: true,
    addColumn: true,
    dropColumn: true,
    modifyColumnType: false,
    modifyColumnNullable: true,
    modifyColumnDefault: true,
    renameColumn: false,
    addIndex: true,
    dropIndex: true,
    foreignKeys: true,
    transactionalDDL: false,
    shadowColumns: false,
    concurrentIndexes: false,
    onlineDDL: false,
};
/**
 * PostgreSQL capabilities
 */
export const POSTGRES_CAPABILITIES = {
    addTable: true,
    dropTable: true,
    addColumn: true,
    dropColumn: true,
    modifyColumnType: true,
    modifyColumnNullable: true,
    modifyColumnDefault: true,
    renameColumn: true,
    addIndex: true,
    dropIndex: true,
    foreignKeys: true,
    transactionalDDL: true,
    shadowColumns: true,
    concurrentIndexes: true,
    onlineDDL: true,
};
/**
 * SQLite capabilities
 */
export const SQLITE_CAPABILITIES = {
    addTable: true,
    dropTable: true,
    addColumn: true,
    dropColumn: false, // SQLite doesn't support DROP COLUMN natively
    modifyColumnType: false,
    modifyColumnNullable: false,
    modifyColumnDefault: false,
    renameColumn: true,
    addIndex: true,
    dropIndex: true,
    foreignKeys: true,
    transactionalDDL: true,
    shadowColumns: false,
    concurrentIndexes: false,
    onlineDDL: false,
};
/**
 * MySQL capabilities
 */
export const MYSQL_CAPABILITIES = {
    addTable: true,
    dropTable: true,
    addColumn: true,
    dropColumn: true,
    modifyColumnType: true,
    modifyColumnNullable: true,
    modifyColumnDefault: true,
    renameColumn: true,
    addIndex: true,
    dropIndex: true,
    foreignKeys: true,
    transactionalDDL: false, // MySQL DDL is not transactional
    shadowColumns: true,
    concurrentIndexes: false,
    onlineDDL: true, // With ALGORITHM=INPLACE
};
/**
 * Check if a step is supported by given capabilities
 */
export function isStepSupported(step, capabilities) {
    switch (step.type) {
        case "add_table":
            return capabilities.addTable;
        case "drop_table":
            return capabilities.dropTable;
        case "add_column":
            return capabilities.addColumn;
        case "drop_column":
            return capabilities.dropColumn;
        case "modify_column":
            // Check specific modification capabilities
            if (step.changes.type && !capabilities.modifyColumnType)
                return false;
            if (step.changes.nullable !== undefined && !capabilities.modifyColumnNullable)
                return false;
            if (step.changes.default !== undefined && !capabilities.modifyColumnDefault)
                return false;
            return true;
        case "add_index":
            return capabilities.addIndex;
        case "drop_index":
            return capabilities.dropIndex;
        case "add_foreign_key":
        case "drop_foreign_key":
            return capabilities.foreignKeys;
        default:
            return false;
    }
}
/**
 * Validate steps against capabilities and return unsupported ones
 */
export function validateStepsAgainstCapabilities(steps, capabilities) {
    const supported = [];
    const unsupported = [];
    for (const step of steps) {
        if (isStepSupported(step, capabilities)) {
            supported.push(step);
        }
        else {
            unsupported.push(step);
        }
    }
    return { supported, unsupported };
}
/**
 * Create a base migration plugin with common functionality
 */
export function createBaseMigrationPlugin(name, capabilities, generateStepSQL) {
    return {
        name,
        capabilities,
        generateSQL(steps) {
            const warnings = [];
            const unsupportedSteps = [];
            const sqlParts = [];
            let safe = true;
            for (const step of steps) {
                if (!isStepSupported(step, capabilities)) {
                    unsupportedSteps.push(step);
                    warnings.push(`Step ${step.type} on ${step.table} is not supported by ${name}`);
                    continue;
                }
                const sql = generateStepSQL(step);
                if (sql) {
                    sqlParts.push(sql);
                }
                // Check if destructive
                if (step.type === "drop_table" || step.type === "drop_column" || step.type === "drop_index") {
                    safe = false;
                }
            }
            return {
                sql: sqlParts.join("\n"),
                safe,
                estimatedTime: steps.length > 10 ? "slow" : steps.length > 3 ? "fast" : "instant",
                warnings,
                unsupportedSteps,
            };
        },
        generateStepSQL,
        supportsStep(stepType) {
            const mockStep = { type: stepType, table: "test" };
            return isStepSupported(mockStep, capabilities);
        },
        getMigrationTableSQL() {
            return `
        CREATE TABLE IF NOT EXISTS _yama_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          type VARCHAR(50) DEFAULT 'schema',
          from_model_hash VARCHAR(64),
          to_model_hash VARCHAR(64),
          checksum VARCHAR(64),
          description TEXT,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `;
        },
        computeChecksum(content) {
            return sha256Hex(content);
        },
    };
}
//# sourceMappingURL=plugin-interface.js.map