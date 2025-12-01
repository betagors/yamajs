import type { YamaEntities } from "../entities.js";
/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
    createdAt: string;
    createdBy: string;
    description?: string;
}
/**
 * Snapshot represents a point-in-time state of the schema
 */
export interface Snapshot {
    hash: string;
    parentHash?: string;
    entities: YamaEntities;
    metadata: SnapshotMetadata;
}
/**
 * Get snapshots directory path
 */
export declare function getSnapshotsDir(configDir: string): string;
/**
 * Get snapshot file path
 */
export declare function getSnapshotPath(configDir: string, hash: string): string;
/**
 * Get manifest file path
 */
export declare function getManifestPath(configDir: string): string;
/**
 * Ensure snapshots directory exists
 */
export declare function ensureSnapshotsDir(configDir: string): void;
/**
 * Snapshot manifest
 */
export interface SnapshotManifest {
    snapshots: Array<{
        hash: string;
        metadata: SnapshotMetadata;
        parentHash?: string;
    }>;
}
/**
 * Load snapshot manifest
 */
export declare function loadManifest(configDir: string): SnapshotManifest;
/**
 * Save snapshot manifest
 */
export declare function saveManifest(configDir: string, manifest: SnapshotManifest): void;
/**
 * Create a snapshot from entities
 */
export declare function createSnapshot(entities: YamaEntities, metadata: SnapshotMetadata, parentHash?: string): Snapshot;
/**
 * Save snapshot to disk
 */
export declare function saveSnapshot(configDir: string, snapshot: Snapshot): void;
/**
 * Load snapshot from disk
 */
export declare function loadSnapshot(configDir: string, hash: string): Snapshot;
/**
 * Check if snapshot exists
 */
export declare function snapshotExists(configDir: string, hash: string): boolean;
/**
 * Get all snapshot hashes
 */
export declare function getAllSnapshotHashes(configDir: string): string[];
/**
 * Find snapshot by hash (partial match)
 */
export declare function findSnapshot(configDir: string, partialHash: string): string | null;
/**
 * Get snapshot metadata
 */
export declare function getSnapshotMetadata(configDir: string, hash: string): SnapshotMetadata | null;
/**
 * Delete snapshot
 */
export declare function deleteSnapshot(configDir: string, hash: string): void;
/**
 * Get all snapshots
 */
export declare function getAllSnapshots(configDir: string): Snapshot[];
