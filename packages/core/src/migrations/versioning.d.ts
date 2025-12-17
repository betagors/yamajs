/**
 * @yamajs/core - Schema Versioning
 *
 * Track schema versions with checksums for migration management.
 */
import type { YamaEntities } from "../entities.js";
/**
 * Schema version record
 */
export interface SchemaVersion {
    /** Version identifier (semantic versioning or auto-generated) */
    version: string;
    /** SHA-256 hash of the schema */
    hash: string;
    /** Names of entities that changed in this version */
    changedEntities: string[];
    /** When this version was recorded */
    appliedAt: string;
    /** Optional description of changes */
    description?: string;
    /** Previous version (for rollback reference) */
    previousVersion?: string;
    /** Previous hash (for rollback reference) */
    previousHash?: string;
}
/**
 * Schema version history
 */
export interface SchemaVersionHistory {
    /** Current version */
    currentVersion: string;
    /** Current hash */
    currentHash: string;
    /** All recorded versions */
    versions: SchemaVersion[];
    /** When history was last updated */
    updatedAt: string;
}
/**
 * Get versioning directory path
 */
export declare function getVersioningDir(projectDir: string): string;
/**
 * Get version history file path
 */
export declare function getVersionHistoryPath(projectDir: string): string;
/**
 * Ensure versioning directory exists
 */
export declare function ensureVersioningDir(projectDir: string): void;
/**
 * Compute a hash of the entities schema
 */
export declare function computeSchemaHash(entities: YamaEntities): string;
/**
 * Load version history
 */
export declare function loadVersionHistory(projectDir: string): SchemaVersionHistory | null;
/**
 * Save version history
 */
export declare function saveVersionHistory(projectDir: string, history: SchemaVersionHistory): void;
/**
 * Get current schema version
 */
export declare function getCurrentSchemaVersion(projectDir: string): SchemaVersion | null;
/**
 * Get current schema hash
 */
export declare function getCurrentSchemaHash(projectDir: string): string | null;
/**
 * Detect which entities changed between two schemas
 */
export declare function detectChangedEntities(oldEntities: YamaEntities | null, newEntities: YamaEntities): string[];
/**
 * Record a new schema version
 */
export declare function recordSchemaVersion(projectDir: string, entities: YamaEntities, options?: {
    version?: string;
    description?: string;
}): SchemaVersion;
/**
 * Load entity snapshot for a version
 */
export declare function loadEntitySnapshot(projectDir: string, version: string): YamaEntities | null;
/**
 * Check if schema has changed since last recorded version
 */
export declare function hasSchemaChanged(projectDir: string, currentEntities: YamaEntities): boolean;
/**
 * Get schema version by version string
 */
export declare function getSchemaVersion(projectDir: string, version: string): SchemaVersion | null;
/**
 * List all schema versions
 */
export declare function listSchemaVersions(projectDir: string): SchemaVersion[];
/**
 * Get version diff between two versions
 */
export interface VersionDiff {
    fromVersion: string;
    toVersion: string;
    addedEntities: string[];
    removedEntities: string[];
    modifiedEntities: string[];
}
export declare function getVersionDiff(projectDir: string, fromVersion: string, toVersion: string): VersionDiff | null;
//# sourceMappingURL=versioning.d.ts.map