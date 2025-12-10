import type { YamaEntities } from "../entities.js";
import type { Snapshot } from "./snapshots.js";
/**
 * Type of conflict detected
 */
export type ConflictType = "field_removed_but_used" | "field_type_mismatch" | "field_required_mismatch" | "entity_removed_but_used" | "ambiguous_change";
/**
 * Conflict information
 */
export interface Conflict {
    type: ConflictType;
    entity: string;
    field?: string;
    description: string;
    localChange: string;
    remoteChange: string;
}
/**
 * Result of merging two schemas
 */
export interface MergeResult {
    success: boolean;
    merged: YamaEntities | null;
    conflicts: Conflict[];
    canAutoMerge: boolean;
    mergedSnapshot?: Snapshot;
}
/**
 * Merge two schemas, detecting conflicts
 */
export declare function mergeSchemas(base: YamaEntities, local: YamaEntities, remote: YamaEntities): MergeResult;
/**
 * Detect conflicts between two schemas
 */
export declare function detectConflicts(base: YamaEntities, local: YamaEntities, remote: YamaEntities): Conflict[];
/**
 * Check if schemas can be auto-merged
 */
export declare function canAutoMerge(base: YamaEntities, local: YamaEntities, remote: YamaEntities): boolean;
/**
 * Create a merge snapshot
 */
export declare function createMergeSnapshot(configDir: string, baseHash: string, localHash: string, remoteHash: string, merged: YamaEntities, metadata: {
    createdAt: string;
    createdBy: string;
    description?: string;
}): Snapshot;
