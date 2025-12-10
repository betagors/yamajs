import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { entitiesToModel } from "./model.js";
/**
 * Get snapshots directory path
 */
export function getSnapshotsDir(configDir) {
    return join(configDir, ".yama", "snapshots");
}
/**
 * Get snapshot file path
 */
export function getSnapshotPath(configDir, hash) {
    return join(getSnapshotsDir(configDir), `${hash}.json`);
}
/**
 * Get manifest file path
 */
export function getManifestPath(configDir) {
    return join(getSnapshotsDir(configDir), "manifest.json");
}
/**
 * Ensure snapshots directory exists
 */
export function ensureSnapshotsDir(configDir) {
    const snapshotsDir = getSnapshotsDir(configDir);
    if (!existsSync(snapshotsDir)) {
        mkdirSync(snapshotsDir, { recursive: true });
    }
}
/**
 * Load snapshot manifest
 */
export function loadManifest(configDir) {
    const manifestPath = getManifestPath(configDir);
    if (!existsSync(manifestPath)) {
        return { snapshots: [] };
    }
    try {
        const content = readFileSync(manifestPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return { snapshots: [] };
    }
}
/**
 * Save snapshot manifest
 */
export function saveManifest(configDir, manifest) {
    ensureSnapshotsDir(configDir);
    const manifestPath = getManifestPath(configDir);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}
/**
 * Create a snapshot from entities
 */
export function createSnapshot(entities, metadata, parentHash) {
    const model = entitiesToModel(entities);
    return {
        hash: model.hash,
        parentHash,
        entities,
        metadata,
    };
}
/**
 * Save snapshot to disk
 */
export function saveSnapshot(configDir, snapshot) {
    ensureSnapshotsDir(configDir);
    const snapshotPath = getSnapshotPath(configDir, snapshot.hash);
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
    // Update manifest
    const manifest = loadManifest(configDir);
    const existingIndex = manifest.snapshots.findIndex(s => s.hash === snapshot.hash);
    if (existingIndex >= 0) {
        manifest.snapshots[existingIndex] = {
            hash: snapshot.hash,
            metadata: snapshot.metadata,
            parentHash: snapshot.parentHash,
        };
    }
    else {
        manifest.snapshots.push({
            hash: snapshot.hash,
            metadata: snapshot.metadata,
            parentHash: snapshot.parentHash,
        });
    }
    saveManifest(configDir, manifest);
}
/**
 * Load snapshot from disk
 */
export function loadSnapshot(configDir, hash) {
    const snapshotPath = getSnapshotPath(configDir, hash);
    if (!existsSync(snapshotPath)) {
        throw new Error(`Snapshot not found: ${hash}`);
    }
    const content = readFileSync(snapshotPath, "utf-8");
    return JSON.parse(content);
}
/**
 * Check if snapshot exists
 */
export function snapshotExists(configDir, hash) {
    const snapshotPath = getSnapshotPath(configDir, hash);
    return existsSync(snapshotPath);
}
/**
 * Get all snapshot hashes
 */
export function getAllSnapshotHashes(configDir) {
    const manifest = loadManifest(configDir);
    return manifest.snapshots.map(s => s.hash);
}
/**
 * Find snapshot by hash (partial match)
 */
export function findSnapshot(configDir, partialHash) {
    const hashes = getAllSnapshotHashes(configDir);
    const match = hashes.find(h => h.startsWith(partialHash));
    return match || null;
}
/**
 * Get snapshot metadata
 */
export function getSnapshotMetadata(configDir, hash) {
    const manifest = loadManifest(configDir);
    const snapshot = manifest.snapshots.find(s => s.hash === hash);
    return snapshot ? snapshot.metadata : null;
}
/**
 * Delete snapshot
 */
export function deleteSnapshot(configDir, hash) {
    const snapshotPath = getSnapshotPath(configDir, hash);
    if (existsSync(snapshotPath)) {
        const fs = require("fs");
        fs.unlinkSync(snapshotPath);
    }
    // Update manifest
    const manifest = loadManifest(configDir);
    manifest.snapshots = manifest.snapshots.filter(s => s.hash !== hash);
    saveManifest(configDir, manifest);
}
/**
 * Get all snapshots
 */
export function getAllSnapshots(configDir) {
    const hashes = getAllSnapshotHashes(configDir);
    return hashes.map(hash => loadSnapshot(configDir, hash));
}
//# sourceMappingURL=snapshots.js.map