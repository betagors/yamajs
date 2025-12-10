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
export declare function getBackupsDir(configDir: string): string;
/**
 * Get snapshots backup directory
 */
export declare function getSnapshotsBackupDir(configDir: string): string;
/**
 * Get incremental backup directory
 */
export declare function getIncrementalBackupDir(configDir: string): string;
/**
 * Get backup manifests directory
 */
export declare function getBackupManifestsDir(configDir: string): string;
/**
 * Ensure backup directories exist
 */
export declare function ensureBackupDirs(configDir: string): void;
/**
 * Generate backup filename
 */
export declare function generateBackupFilename(snapshot: string, timestamp: string, extension?: string): string;
/**
 * Calculate checksum of data
 */
export declare function calculateChecksum(data: string | Buffer): string;
/**
 * Register a backup
 */
export declare function registerBackup(configDir: string, metadata: BackupMetadata, filename: string): void;
/**
 * Load backup metadata
 */
export declare function loadBackupMetadata(configDir: string, snapshot: string, timestamp: string): BackupMetadata | null;
/**
 * List all backups
 */
export declare function listBackups(configDir: string): BackupEntry[];
/**
 * Get backups for a specific snapshot
 */
export declare function getBackupsForSnapshot(configDir: string, snapshot: string): BackupEntry[];
/**
 * Create backup chain
 */
export declare function createBackupChain(configDir: string, baseSnapshot: string): BackupChain | null;
/**
 * Load backup chain
 */
export declare function loadBackupChain(configDir: string, chainFile: string): BackupChain | null;
/**
 * Calculate total backup size
 */
export declare function calculateBackupSize(configDir: string): number;
/**
 * Check if backup is expired based on retention policy
 */
export declare function isBackupExpired(metadata: BackupMetadata, now?: Date): boolean;
/**
 * Get expired backups
 */
export declare function getExpiredBackups(configDir: string): BackupEntry[];
