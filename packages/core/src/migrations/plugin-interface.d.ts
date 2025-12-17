import type { MigrationStepUnion, MigrationStepType } from "./diff.js";
/**
 * Database capabilities for migration operations
 */
export interface DatabaseCapabilities {
    /** Supports adding tables */
    addTable: boolean;
    /** Supports dropping tables */
    dropTable: boolean;
    /** Supports adding columns */
    addColumn: boolean;
    /** Supports dropping columns */
    dropColumn: boolean;
    /** Supports modifying column types */
    modifyColumnType: boolean;
    /** Supports changing column nullability */
    modifyColumnNullable: boolean;
    /** Supports changing column defaults */
    modifyColumnDefault: boolean;
    /** Supports renaming columns */
    renameColumn: boolean;
    /** Supports adding indexes */
    addIndex: boolean;
    /** Supports dropping indexes */
    dropIndex: boolean;
    /** Supports foreign keys */
    foreignKeys: boolean;
    /** Supports transactional DDL */
    transactionalDDL: boolean;
    /** Supports shadow columns for safe deletions */
    shadowColumns: boolean;
    /** Supports concurrent index creation */
    concurrentIndexes: boolean;
    /** Supports online DDL (minimal locking) */
    onlineDDL: boolean;
}
/**
 * Default capabilities (most databases support these)
 */
export declare const DEFAULT_CAPABILITIES: DatabaseCapabilities;
/**
 * PostgreSQL capabilities
 */
export declare const POSTGRES_CAPABILITIES: DatabaseCapabilities;
/**
 * SQLite capabilities
 */
export declare const SQLITE_CAPABILITIES: DatabaseCapabilities;
/**
 * MySQL capabilities
 */
export declare const MYSQL_CAPABILITIES: DatabaseCapabilities;
/**
 * Result of SQL generation
 */
export interface SQLGenerationResult {
    /** The SQL to execute */
    sql: string;
    /** Whether the operation is safe (non-destructive) */
    safe: boolean;
    /** Estimated execution time hint */
    estimatedTime?: "instant" | "fast" | "slow" | "unknown";
    /** Warning messages */
    warnings: string[];
    /** Steps that couldn't be generated */
    unsupportedSteps: MigrationStepUnion[];
}
/**
 * Migration plugin interface that database adapters must implement
 */
export interface MigrationPlugin {
    /** Plugin/database name */
    name: string;
    /** Database capabilities */
    capabilities: DatabaseCapabilities;
    /**
     * Generate SQL from migration steps
     * @param steps Migration steps to convert to SQL
     * @returns SQL generation result
     */
    generateSQL(steps: MigrationStepUnion[]): SQLGenerationResult;
    /**
     * Generate SQL for a single step
     * @param step Single migration step
     * @returns SQL string or null if not supported
     */
    generateStepSQL(step: MigrationStepUnion): string | null;
    /**
     * Check if a step type is supported
     * @param stepType The step type to check
     */
    supportsStep(stepType: MigrationStepType): boolean;
    /**
     * Get SQL for creating migration tracking tables
     */
    getMigrationTableSQL(): string;
    /**
     * Compute checksum for migration content
     */
    computeChecksum(content: string): string;
}
/**
 * Check if a step is supported by given capabilities
 */
export declare function isStepSupported(step: MigrationStepUnion, capabilities: DatabaseCapabilities): boolean;
/**
 * Validate steps against capabilities and return unsupported ones
 */
export declare function validateStepsAgainstCapabilities(steps: MigrationStepUnion[], capabilities: DatabaseCapabilities): {
    supported: MigrationStepUnion[];
    unsupported: MigrationStepUnion[];
};
/**
 * Create a base migration plugin with common functionality
 */
export declare function createBaseMigrationPlugin(name: string, capabilities: DatabaseCapabilities, generateStepSQL: (step: MigrationStepUnion) => string | null): MigrationPlugin;
//# sourceMappingURL=plugin-interface.d.ts.map