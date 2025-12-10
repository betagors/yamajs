/**
 * @betagors/yama-core - Schema Versioning
 * 
 * Track schema versions with checksums for migration management.
 */

import { getFileSystem, getPathModule } from "../platform/fs.js";
import { sha256Hex } from "../platform/hash.js";
import type { YamaEntities } from "../entities.js";
import { computeModelHash } from "./model.js";

const fs = () => getFileSystem();
const path = () => getPathModule();

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
export function ensureVersioningDir(projectDir: string): void {
  const versioningDir = getVersioningDir(projectDir);
  if (!fs().existsSync(versioningDir)) {
    fs().mkdirSync(versioningDir, { recursive: true });
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
export function loadVersionHistory(projectDir: string): SchemaVersionHistory | null {
  const historyPath = getVersionHistoryPath(projectDir);
  if (!fs().existsSync(historyPath)) {
    return null;
  }
  
  try {
    const content = fs().readFileSync(historyPath, "utf-8");
    return JSON.parse(content) as SchemaVersionHistory;
  } catch {
    return null;
  }
}

/**
 * Save version history
 */
export function saveVersionHistory(projectDir: string, history: SchemaVersionHistory): void {
  ensureVersioningDir(projectDir);
  const historyPath = getVersionHistoryPath(projectDir);
  fs().writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
}

/**
 * Get current schema version
 */
export function getCurrentSchemaVersion(projectDir: string): SchemaVersion | null {
  const history = loadVersionHistory(projectDir);
  if (!history || history.versions.length === 0) {
    return null;
  }
  return history.versions[history.versions.length - 1];
}

/**
 * Get current schema hash
 */
export function getCurrentSchemaHash(projectDir: string): string | null {
  const history = loadVersionHistory(projectDir);
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
export function recordSchemaVersion(
  projectDir: string,
  entities: YamaEntities,
  options: {
    version?: string;
    description?: string;
  } = {}
): SchemaVersion {
  const history = loadVersionHistory(projectDir);
  const hash = computeSchemaHash(entities);
  
  // Check if schema actually changed
  if (history?.currentHash === hash) {
    throw new Error("Schema has not changed since last version");
  }
  
  // Get previous entities for comparison
  const previousEntities = getPreviousEntities(projectDir);
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
  
  saveVersionHistory(projectDir, newHistory);
  
  // Save entity snapshot
  saveEntitySnapshot(projectDir, version.version, entities);
  
  return version;
}

/**
 * Save entity snapshot for a version
 */
function saveEntitySnapshot(
  projectDir: string,
  version: string,
  entities: YamaEntities
): void {
  const snapshotDir = path().join(getVersioningDir(projectDir), "snapshots");
  if (!fs().existsSync(snapshotDir)) {
    fs().mkdirSync(snapshotDir, { recursive: true });
  }
  
  const snapshotPath = path().join(snapshotDir, `${version}.json`);
  fs().writeFileSync(snapshotPath, JSON.stringify(entities, null, 2), "utf-8");
}

/**
 * Load entity snapshot for a version
 */
export function loadEntitySnapshot(
  projectDir: string,
  version: string
): YamaEntities | null {
  const snapshotPath = path().join(
    getVersioningDir(projectDir),
    "snapshots",
    `${version}.json`
  );
  
  if (!fs().existsSync(snapshotPath)) {
    return null;
  }
  
  try {
    const content = fs().readFileSync(snapshotPath, "utf-8");
    return JSON.parse(content) as YamaEntities;
  } catch {
    return null;
  }
}

/**
 * Get entities from previous version
 */
function getPreviousEntities(projectDir: string): YamaEntities | null {
  const history = loadVersionHistory(projectDir);
  if (!history || history.versions.length === 0) {
    return null;
  }
  
  const lastVersion = history.versions[history.versions.length - 1];
  return loadEntitySnapshot(projectDir, lastVersion.version);
}

/**
 * Check if schema has changed since last recorded version
 */
export function hasSchemaChanged(
  projectDir: string,
  currentEntities: YamaEntities
): boolean {
  const currentHash = getCurrentSchemaHash(projectDir);
  if (!currentHash) {
    return true; // No previous version
  }
  
  const newHash = computeSchemaHash(currentEntities);
  return currentHash !== newHash;
}

/**
 * Get schema version by version string
 */
export function getSchemaVersion(
  projectDir: string,
  version: string
): SchemaVersion | null {
  const history = loadVersionHistory(projectDir);
  if (!history) {
    return null;
  }
  
  return history.versions.find(v => v.version === version) || null;
}

/**
 * List all schema versions
 */
export function listSchemaVersions(projectDir: string): SchemaVersion[] {
  const history = loadVersionHistory(projectDir);
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

export function getVersionDiff(
  projectDir: string,
  fromVersion: string,
  toVersion: string
): VersionDiff | null {
  const fromEntities = loadEntitySnapshot(projectDir, fromVersion);
  const toEntities = loadEntitySnapshot(projectDir, toVersion);
  
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
