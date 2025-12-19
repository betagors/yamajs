import { getRuntime } from "../../../../../../../../../../../core/kernel/src/platform/index.js";
import type { YamaEntities } from "@yamajs/kernel";
import { entitiesToModel } from "../../../../../../../../../../../core/kernel/src/migrations/model.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

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
export function getSnapshotsDir(configDir: string): string {
  return path().join(configDir, ".yama", "snapshots");
}

/**
 * Get snapshot file path
 */
export function getSnapshotPath(configDir: string, hash: string): string {
  return path().join(getSnapshotsDir(configDir), `${hash}.json`);
}

/**
 * Get manifest file path
 */
export function getManifestPath(configDir: string): string {
  return path().join(getSnapshotsDir(configDir), "manifest.json");
}

/**
 * Ensure snapshots directory exists
 */
export async function ensureSnapshotsDir(configDir: string): Promise<void> {
  const snapshotsDir = getSnapshotsDir(configDir);
  if (!await fs().exists(snapshotsDir)) {
    await fs().mkdir(snapshotsDir);
  }
}

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
export async function loadManifest(configDir: string): Promise<SnapshotManifest> {
  const manifestPath = getManifestPath(configDir);
  if (!await fs().exists(manifestPath)) {
    return { snapshots: [] };
  }

  try {
    const content = await fs().readTextFile(manifestPath);
    return JSON.parse(content) as SnapshotManifest;
  } catch {
    return { snapshots: [] };
  }
}

/**
 * Save snapshot manifest
 */
export async function saveManifest(configDir: string, manifest: SnapshotManifest): Promise<void> {
  await ensureSnapshotsDir(configDir);
  const manifestPath = getManifestPath(configDir);
  await fs().writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Create a snapshot from entities
 */
export function createSnapshot(
  entities: YamaEntities,
  metadata: SnapshotMetadata,
  parentHash?: string
): Snapshot {
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
export async function saveSnapshot(configDir: string, snapshot: Snapshot): Promise<void> {
  await ensureSnapshotsDir(configDir);
  const snapshotPath = getSnapshotPath(configDir, snapshot.hash);
  await fs().writeTextFile(snapshotPath, JSON.stringify(snapshot, null, 2));

  // Update manifest
  const manifest = await loadManifest(configDir);
  const existingIndex = manifest.snapshots.findIndex(s => s.hash === snapshot.hash);
  if (existingIndex >= 0) {
    manifest.snapshots[existingIndex] = {
      hash: snapshot.hash,
      metadata: snapshot.metadata,
      parentHash: snapshot.parentHash,
    };
  } else {
    manifest.snapshots.push({
      hash: snapshot.hash,
      metadata: snapshot.metadata,
      parentHash: snapshot.parentHash,
    });
  }
  await saveManifest(configDir, manifest);
}

/**
 * Load snapshot from disk
 */
export async function loadSnapshot(configDir: string, hash: string): Promise<Snapshot> {
  const snapshotPath = getSnapshotPath(configDir, hash);
  if (!await fs().exists(snapshotPath)) {
    throw new Error(`Snapshot not found: ${hash}`);
  }

  const content = await fs().readTextFile(snapshotPath);
  return JSON.parse(content) as Snapshot;
}

/**
 * Check if snapshot exists
 */
export async function snapshotExists(configDir: string, hash: string): Promise<boolean> {
  const snapshotPath = getSnapshotPath(configDir, hash);
  return fs().exists(snapshotPath);
}

/**
 * Get all snapshot hashes
 */
export async function getAllSnapshotHashes(configDir: string): Promise<string[]> {
  const manifest = await loadManifest(configDir);
  return manifest.snapshots.map(s => s.hash);
}

/**
 * Find snapshot by hash (partial match)
 */
export async function findSnapshot(configDir: string, partialHash: string): Promise<string | null> {
  const hashes = await getAllSnapshotHashes(configDir);
  const match = hashes.find(h => h.startsWith(partialHash));
  return match || null;
}

/**
 * Get snapshot metadata
 */
export async function getSnapshotMetadata(configDir: string, hash: string): Promise<SnapshotMetadata | null> {
  const manifest = await loadManifest(configDir);
  const snapshot = manifest.snapshots.find(s => s.hash === hash);
  return snapshot ? snapshot.metadata : null;
}

/**
 * Delete snapshot
 */
export async function deleteSnapshot(configDir: string, hash: string): Promise<void> {
  const snapshotPath = getSnapshotPath(configDir, hash);
  if (await fs().exists(snapshotPath)) {
    await fs().remove(snapshotPath);
  }

  // Update manifest
  const manifest = await loadManifest(configDir);
  manifest.snapshots = manifest.snapshots.filter(s => s.hash !== hash);
  await saveManifest(configDir, manifest);
}

/**
 * Get all snapshots
 */
export async function getAllSnapshots(configDir: string): Promise<Snapshot[]> {
  const hashes = await getAllSnapshotHashes(configDir);
  const snapshots: Snapshot[] = [];
  for (const hash of hashes) {
    snapshots.push(await loadSnapshot(configDir, hash));
  }
  return snapshots;
}
