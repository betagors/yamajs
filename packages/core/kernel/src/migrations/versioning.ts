/**
 * @yamajs/core - Schema Versioning
 * 
 * Track schema versions with checksums for migration management.
 */

import { getRuntime } from "../../../../../../../../core/kernel/src/platform/index.js";
import { sha256Hex } from "../../../../../../../../core/kernel/src/platform/hash.js";
import type { YamaEntities } from "@yamajs/kernel";
import { computeModelHash } from "../../../../../../../../core/kernel/src/migrations/model.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

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
export function getVersioningDir(projectDir: string): string {
  return path().join(projectDir, ".yama", "versions");
}

/**
 * Get version history file path
 */
export function getVersionHistoryPath(projectDir: string): string {
  return path().join(getVersioningDir(projectDir), "history.json");
}

/**
 * Ensure versioning directory exists
 */
export async function ensureVersioningDir(projectDir: string): Promise<void> {
  const versioningDir = getVersioningDir(projectDir);
  if (!await fs().exists(versioningDir)) {
    await fs().mkdir(versioningDir);
  }
}

/**
 * Compute a hash of the entities schema
 */
export function computeSchemaHash(entities: YamaEntities): string {
  return computeModelHash(entities);
}

/**
 * Load version history
 */
export async function loadVersionHistory(projectDir: string): Promise<SchemaVersionHistory | null> {
  const historyPath = getVersionHistoryPath(projectDir);
  if (!await fs().exists(historyPath)) {
    return null;
  }

  try {
    const content = await fs().readTextFile(historyPath);
    return JSON.parse(content) as SchemaVersionHistory;
  } catch {
    return null;
  }
}

/**
 * Save version history
 */
export async function saveVersionHistory(projectDir: string, history: SchemaVersionHistory): Promise<void> {
  await ensureVersioningDir(projectDir);
  const historyPath = getVersionHistoryPath(projectDir);
  await fs().writeTextFile(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Get current schema version
 */
export async function getCurrentSchemaVersion(projectDir: string): Promise<SchemaVersion | null> {
  const history = await loadVersionHistory(projectDir);
  if (!history || history.versions.length === 0) {
    return null;
  }
  return history.versions[history.versions.length - 1];
}

/**
 * Get current schema hash
 */
export async function getCurrentSchemaHash(projectDir: string): Promise<string | null> {
  const history = await loadVersionHistory(projectDir);
  return history?.currentHash || null;
}

/**
 * Generate auto version number
 */
function generateVersionNumber(history: SchemaVersionHistory | null): string {
  if (!history || history.versions.length === 0) {
    return "0.0.1";
  }

  const lastVersion = history.versions[history.versions.length - 1].version;
  const parts = lastVersion.split(".").map(Number);

  // Increment patch version
  if (parts.length >= 3) {
    parts[2] = (parts[2] || 0) + 1;
  } else if (parts.length === 2) {
    parts.push(1);
  } else {
    parts.push(0, 1);
  }

  return parts.join(".");
}

/**
 * Detect which entities changed between two schemas
 */
export function detectChangedEntities(
  oldEntities: YamaEntities | null,
  newEntities: YamaEntities
): string[] {
  const changed: string[] = [];
  const oldNames = new Set(oldEntities ? Object.keys(oldEntities) : []);
  const newNames = new Set(Object.keys(newEntities));

  // Added entities
  for (const name of newNames) {
    if (!oldNames.has(name)) {
      changed.push(name);
    }
  }

  // Removed entities
  for (const name of oldNames) {
    if (!newNames.has(name)) {
      changed.push(name);
    }
  }

  // Modified entities (compare hashes)
  if (oldEntities) {
    for (const name of newNames) {
      if (oldNames.has(name)) {
        const oldHash = sha256Hex(JSON.stringify(oldEntities[name]));
        const newHash = sha256Hex(JSON.stringify(newEntities[name]));

        if (oldHash !== newHash) {
          changed.push(name);
        }
      }
    }
  }

  return [...new Set(changed)]; // Remove duplicates
}

/**
 * Record a new schema version
 */
export async function recordSchemaVersion(
  projectDir: string,
  entities: YamaEntities,
  options: {
    version?: string;
    description?: string;
  } = {}
): Promise<SchemaVersion> {
  const history = await loadVersionHistory(projectDir);
  const hash = computeSchemaHash(entities);

  // Check if schema actually changed
  if (history?.currentHash === hash) {
    throw new Error("Schema has not changed since last version");
  }

  // Get previous entities for comparison
  const previousEntities = await getPreviousEntities(projectDir);
  const changedEntities = detectChangedEntities(previousEntities, entities);

  // Create new version
  const version: SchemaVersion = {
    version: options.version || generateVersionNumber(history),
    hash,
    changedEntities,
    appliedAt: new Date().toISOString(),
    description: options.description,
    previousVersion: history?.currentVersion,
    previousHash: history?.currentHash,
  };

  // Update history
  const newHistory: SchemaVersionHistory = {
    currentVersion: version.version,
    currentHash: hash,
    versions: [...(history?.versions || []), version],
    updatedAt: new Date().toISOString(),
  };

  await saveVersionHistory(projectDir, newHistory);

  // Save entity snapshot
  await saveEntitySnapshot(projectDir, version.version, entities);

  return version;
}

/**
 * Save entity snapshot for a version
 */
async function saveEntitySnapshot(
  projectDir: string,
  version: string,
  entities: YamaEntities
): Promise<void> {
  const snapshotDir = path().join(getVersioningDir(projectDir), "snapshots");
  if (!await fs().exists(snapshotDir)) {
    await fs().mkdir(snapshotDir);
  }

  const snapshotPath = path().join(snapshotDir, `${version}.json`);
  await fs().writeTextFile(snapshotPath, JSON.stringify(entities, null, 2));
}

/**
 * Load entity snapshot for a version
 */
export async function loadEntitySnapshot(
  projectDir: string,
  version: string
): Promise<YamaEntities | null> {
  const snapshotPath = path().join(
    getVersioningDir(projectDir),
    "snapshots",
    `${version}.json`
  );

  if (!await fs().exists(snapshotPath)) {
    return null;
  }

  try {
    const content = await fs().readTextFile(snapshotPath);
    return JSON.parse(content) as YamaEntities;
  } catch {
    return null;
  }
}

/**
 * Get entities from previous version
 */
async function getPreviousEntities(projectDir: string): Promise<YamaEntities | null> {
  const history = await loadVersionHistory(projectDir);
  if (!history || history.versions.length === 0) {
    return null;
  }

  const lastVersion = history.versions[history.versions.length - 1];
  return loadEntitySnapshot(projectDir, lastVersion.version);
}

/**
 * Check if schema has changed since last recorded version
 */
export async function hasSchemaChanged(
  projectDir: string,
  currentEntities: YamaEntities
): Promise<boolean> {
  const currentHash = await getCurrentSchemaHash(projectDir);
  if (!currentHash) {
    return true; // No previous version
  }

  const newHash = computeSchemaHash(currentEntities);
  return currentHash !== newHash;
}

/**
 * Get schema version by version string
 */
export async function getSchemaVersion(
  projectDir: string,
  version: string
): Promise<SchemaVersion | null> {
  const history = await loadVersionHistory(projectDir);
  if (!history) {
    return null;
  }

  return history.versions.find(v => v.version === version) || null;
}

/**
 * List all schema versions
 */
export async function listSchemaVersions(projectDir: string): Promise<SchemaVersion[]> {
  const history = await loadVersionHistory(projectDir);
  return history?.versions || [];
}

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

export async function getVersionDiff(
  projectDir: string,
  fromVersion: string,
  toVersion: string
): Promise<VersionDiff | null> {
  const fromEntities = await loadEntitySnapshot(projectDir, fromVersion);
  const toEntities = await loadEntitySnapshot(projectDir, toVersion);

  if (!fromEntities || !toEntities) {
    return null;
  }

  const fromNames = new Set(Object.keys(fromEntities));
  const toNames = new Set(Object.keys(toEntities));

  const addedEntities: string[] = [];
  const removedEntities: string[] = [];
  const modifiedEntities: string[] = [];

  // Added
  for (const name of toNames) {
    if (!fromNames.has(name)) {
      addedEntities.push(name);
    }
  }

  // Removed
  for (const name of fromNames) {
    if (!toNames.has(name)) {
      removedEntities.push(name);
    }
  }

  // Modified
  for (const name of toNames) {
    if (fromNames.has(name)) {
      const fromHash = sha256Hex(JSON.stringify(fromEntities[name]));
      const toHash = sha256Hex(JSON.stringify(toEntities[name]));

      if (fromHash !== toHash) {
        modifiedEntities.push(name);
      }
    }
  }

  return {
    fromVersion,
    toVersion,
    addedEntities,
    removedEntities,
    modifiedEntities,
  };
}
