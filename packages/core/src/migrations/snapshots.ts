import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import type { YamaEntities } from "../entities.js";
import { entitiesToModel } from "./model.js";

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
  return join(configDir, ".yama", "snapshots");
}

/**
 * Get snapshot file path
 */
export function getSnapshotPath(configDir: string, hash: string): string {
  return join(getSnapshotsDir(configDir), `${hash}.json`);
}

/**
 * Get manifest file path
 */
export function getManifestPath(configDir: string): string {
  return join(getSnapshotsDir(configDir), "manifest.json");
}

/**
 * Ensure snapshots directory exists
 */
export function ensureSnapshotsDir(configDir: string): void {
  const snapshotsDir = getSnapshotsDir(configDir);
  if (!existsSync(snapshotsDir)) {
    mkdirSync(snapshotsDir, { recursive: true });
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
export function loadManifest(configDir: string): SnapshotManifest {
  const manifestPath = getManifestPath(configDir);
  if (!existsSync(manifestPath)) {
    return { snapshots: [] };
  }
  
  try {
    const content = readFileSync(manifestPath, "utf-8");
    return JSON.parse(content) as SnapshotManifest;
  } catch {
    return { snapshots: [] };
  }
}

/**
 * Save snapshot manifest
 */
export function saveManifest(configDir: string, manifest: SnapshotManifest): void {
  ensureSnapshotsDir(configDir);
  const manifestPath = getManifestPath(configDir);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
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
export function saveSnapshot(configDir: string, snapshot: Snapshot): void {
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
  } else {
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
export function loadSnapshot(configDir: string, hash: string): Snapshot {
  const snapshotPath = getSnapshotPath(configDir, hash);
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${hash}`);
  }
  
  const content = readFileSync(snapshotPath, "utf-8");
  return JSON.parse(content) as Snapshot;
}

/**
 * Check if snapshot exists
 */
export function snapshotExists(configDir: string, hash: string): boolean {
  const snapshotPath = getSnapshotPath(configDir, hash);
  return existsSync(snapshotPath);
}

/**
 * Get all snapshot hashes
 */
export function getAllSnapshotHashes(configDir: string): string[] {
  const manifest = loadManifest(configDir);
  return manifest.snapshots.map(s => s.hash);
}

/**
 * Find snapshot by hash (partial match)
 */
export function findSnapshot(configDir: string, partialHash: string): string | null {
  const hashes = getAllSnapshotHashes(configDir);
  const match = hashes.find(h => h.startsWith(partialHash));
  return match || null;
}

/**
 * Get snapshot metadata
 */
export function getSnapshotMetadata(configDir: string, hash: string): SnapshotMetadata | null {
  const manifest = loadManifest(configDir);
  const snapshot = manifest.snapshots.find(s => s.hash === hash);
  return snapshot ? snapshot.metadata : null;
}

/**
 * Delete snapshot
 */
export function deleteSnapshot(configDir: string, hash: string): void {
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
export function getAllSnapshots(configDir: string): Snapshot[] {
  const hashes = getAllSnapshotHashes(configDir);
  return hashes.map(hash => loadSnapshot(configDir, hash));
}
