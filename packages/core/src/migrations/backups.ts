import { getFileSystem, getPathModule } from "../platform/fs.js";
import { sha256Hex } from "../platform/hash.js";

const fs = () => getFileSystem();
const path = () => getPathModule();

/**
 * Backup metadata
 */
export interface BackupMetadata {
  snapshot: string;
  timestamp: string;
  database: {
    provider: string;
    version?: string;
    size?: string;
  };
  tables: Record<string, {
    rows: number;
    size: string;
  }>;
  trigger: "schema_transition" | "data_transformation" | "schedule" | "production_deploy" | "manual";
  transition?: string;
  checksum: string;
  compression?: {
    algorithm: string;
    level: number;
  };
  compressedSize?: string;
  retentionPolicy: string;
}

/**
 * Backup entry
 */
export interface BackupEntry {
  filename: string;
  metadata: BackupMetadata;
  filePath: string;
  size: number;
}

/**
 * Backup chain for incremental backups
 */
export interface BackupChain {
  base: string;
  fullBackup: string;
  size: string;
  incrementals: Array<{
    snapshot: string;
    file: string;
    size: string;
    changes: string[];
  }>;
  totalSize: string;
}

/**
 * Get backups directory path
 */
export function getBackupsDir(configDir: string): string {
  return path().join(configDir, ".yama", "backups");
}

/**
 * Get snapshots backup directory
 */
export function getSnapshotsBackupDir(configDir: string): string {
  return path().join(getBackupsDir(configDir), "snapshots");
}

/**
 * Get incremental backup directory
 */
export function getIncrementalBackupDir(configDir: string): string {
  return path().join(getBackupsDir(configDir), "incremental");
}

/**
 * Get backup manifests directory
 */
export function getBackupManifestsDir(configDir: string): string {
  return path().join(getBackupsDir(configDir), "manifests");
}

/**
 * Ensure backup directories exist
 */
export function ensureBackupDirs(configDir: string): void {
  fs().mkdirSync(getSnapshotsBackupDir(configDir), { recursive: true });
  fs().mkdirSync(getIncrementalBackupDir(configDir), { recursive: true });
  fs().mkdirSync(getBackupManifestsDir(configDir), { recursive: true });
}

/**
 * Generate backup filename
 */
export function generateBackupFilename(
  snapshot: string,
  timestamp: string,
  extension: string = "dump"
): string {
  const ts = timestamp.replace(/[:.]/g, "-").replace("T", "_").split(".")[0];
  return `${snapshot}_${ts}.${extension}`;
}

/**
 * Calculate checksum of data
 */
export function calculateChecksum(data: string | Uint8Array): string {
  const asBytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return `sha256:${sha256Hex(asBytes)}`;
}

/**
 * Register a backup
 */
export function registerBackup(
  configDir: string,
  metadata: BackupMetadata,
  filename: string
): void {
  ensureBackupDirs(configDir);
  
  // Save metadata
  const metadataPath = path().join(
    getBackupManifestsDir(configDir),
    `${metadata.snapshot}_${metadata.timestamp.replace(/[:.]/g, "-")}.json`
  );
  fs().writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}

/**
 * Load backup metadata
 */
export function loadBackupMetadata(
  configDir: string,
  snapshot: string,
  timestamp: string
): BackupMetadata | null {
  const metadataPath = path().join(
    getBackupManifestsDir(configDir),
    `${snapshot}_${timestamp.replace(/[:.]/g, "-")}.json`
  );
  
  if (!fs().existsSync(metadataPath)) {
    return null;
  }
  
  try {
    const content = fs().readFileSync(metadataPath, "utf-8");
    return JSON.parse(content) as BackupMetadata;
  } catch {
    return null;
  }
}

/**
 * List all backups
 */
export function listBackups(configDir: string): BackupEntry[] {
  const manifestsDir = getBackupManifestsDir(configDir);
  if (!fs().existsSync(manifestsDir)) {
    return [];
  }

  const files = fs().readdirSync?.(manifestsDir) ?? [];
  const backups: BackupEntry[] = [];
  
  for (const file of files) {
    if (file.endsWith(".json")) {
      try {
        const content = fs().readFileSync(path().join(manifestsDir, file), "utf-8");
        const metadata = JSON.parse(content) as BackupMetadata;
        const filename = generateBackupFilename(
          metadata.snapshot,
          metadata.timestamp
        );
        const filePath = path().join(getSnapshotsBackupDir(configDir), filename);
        
        let size = 0;
        if (fs().existsSync(filePath) && fs().statSync) {
          size = fs().statSync!(filePath).size ?? 0;
        }
        
        backups.push({
          filename,
          metadata,
          filePath,
          size,
        });
      } catch {
        // Skip invalid files
      }
    }
  }
  
  // Sort by timestamp (newest first)
  backups.sort((a, b) =>
    b.metadata.timestamp.localeCompare(a.metadata.timestamp)
  );
  
  return backups;
}

/**
 * Get backups for a specific snapshot
 */
export function getBackupsForSnapshot(
  configDir: string,
  snapshot: string
): BackupEntry[] {
  const allBackups = listBackups(configDir);
  return allBackups.filter((b) => b.metadata.snapshot === snapshot);
}

/**
 * Create backup chain
 */
export function createBackupChain(
  configDir: string,
  baseSnapshot: string
): BackupChain | null {
  const backups = listBackups(configDir);
  const baseBackup = backups.find((b) => b.metadata.snapshot === baseSnapshot);
  
  if (!baseBackup) {
    return null;
  }
  
  const chain: BackupChain = {
    base: baseSnapshot,
    fullBackup: baseBackup.filename,
    size: formatBytes(baseBackup.size),
    incrementals: [],
    totalSize: formatBytes(baseBackup.size),
  };
  
  // Find incrementals that build on this base
  // This would need to track which incrementals belong to which chain
  // For now, we'll return the base chain
  
  return chain;
}

/**
 * Load backup chain
 */
export function loadBackupChain(
  configDir: string,
  chainFile: string
): BackupChain | null {
  const chainPath = path().join(getBackupManifestsDir(configDir), chainFile);
  
  if (!fs().existsSync(chainPath)) {
    return null;
  }
  
  try {
    const content = fs().readFileSync(chainPath, "utf-8");
    return JSON.parse(content) as BackupChain;
  } catch {
    return null;
  }
}

/**
 * Calculate total backup size
 */
export function calculateBackupSize(configDir: string): number {
  const backups = listBackups(configDir);
  return backups.reduce((sum, backup) => sum + backup.size, 0);
}

/**
 * Check if backup is expired based on retention policy
 */
export function isBackupExpired(
  metadata: BackupMetadata,
  now: Date = new Date()
): boolean {
  const backupDate = new Date(metadata.timestamp);
  const retentionDays = parseRetentionPolicy(metadata.retentionPolicy);
  
  if (!retentionDays) {
    return false; // No expiration
  }
  
  const expirationDate = new Date(backupDate);
  expirationDate.setDate(expirationDate.getDate() + retentionDays);
  
  return now > expirationDate;
}

/**
 * Get expired backups
 */
export function getExpiredBackups(configDir: string): BackupEntry[] {
  const backups = listBackups(configDir);
  const now = new Date();
  return backups.filter((b) => isBackupExpired(b.metadata, now));
}

/**
 * Parse retention policy string
 */
function parseRetentionPolicy(policy: string): number | null {
  // Examples: "30d", "7d", "90d"
  const match = policy.match(/(\d+)d/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
















