/**
 * @yamajs/core - Migration Generator
 *
 * Semi-automatic migration generation from entity changes.
 * Generates migration steps with preview and confirmation support.
 */
import type { YamaEntities } from "../entities.js";
import type { MigrationStepUnion, DiffResult } from "./diff.js";
import { SafetyLevel } from "./safety.js";
/**
 * Options for migration generation
 */
export interface MigrationGeneratorOptions {
    /** Preview mode - show what would be generated without creating files */
    preview?: boolean;
    /** Interactive mode - prompt for confirmation */
    interactive?: boolean;
    /** Allow destructive operations (DROP) */
    destructive?: boolean;
    /** Include rollback steps */
    includeRollback?: boolean;
    /** Migration name/description */
    name?: string;
}
/**
 * Generated migration
 */
export interface GeneratedMigration {
    /** Migration name/identifier */
    name: string;
    /** When generated */
    generatedAt: string;
    /** Source schema hash */
    fromHash: string | null;
    /** Target schema hash */
    toHash: string;
    /** Up migration steps */
    up: MigrationStepUnion[];
    /** Down migration steps (rollback) */
    down: MigrationStepUnion[];
    /** Diff result for reference */
    diff: DiffResult;
    /** Safety assessment */
    safety: MigrationSafetyInfo;
    /** Whether migration has destructive operations */
    hasDestructiveOperations: boolean;
    /** Human-readable summary */
    summary: MigrationSummary;
}
/**
 * Migration safety information
 */
export interface MigrationSafetyInfo {
    level: SafetyLevel;
    warnings: string[];
    recommendations: string[];
    requiresBackup: boolean;
    requiresDowntime: boolean;
}
/**
 * Human-readable migration summary
 */
export interface MigrationSummary {
    description: string;
    changes: string[];
    tablesAdded: number;
    tablesRemoved: number;
    columnsAdded: number;
    columnsRemoved: number;
    columnsModified: number;
    indexesAdded: number;
    indexesRemoved: number;
}
/**
 * Generate a migration from entity changes
 */
export declare function generateMigration(projectDir: string, currentEntities: YamaEntities, options?: MigrationGeneratorOptions): Promise<GeneratedMigration>;
/**
 * Format migration for display
 */
export declare function formatMigration(migration: GeneratedMigration): string;
/**
 * Check if entities have changed since last recorded version
 */
export declare function hasEntityChanges(projectDir: string, currentEntities: YamaEntities): boolean;
//# sourceMappingURL=generator.d.ts.map