import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
/**
 * Get backups directory path
 */
export function getBackupsDir(configDir) {
    return join(configDir, ".yama", "backups");
}
/**
 * Get snapshots backup directory
 */
export function getSnapshotsBackupDir(configDir) {
    return join(getBackupsDir(configDir), "snapshots");
}
/**
 * Get incremental backup directory
 */
export function getIncrementalBackupDir(configDir) {
    return join(getBackupsDir(configDir), "incremental");
}
/**
 * Get backup manifests directory
 */
export function getBackupManifestsDir(configDir) {
    return join(getBackupsDir(configDir), "manifests");
}
/**
 * Ensure backup directories exist
 */
export function ensureBackupDirs(configDir) {
    mkdirSync(getSnapshotsBackupDir(configDir), { recursive: true });
    mkdirSync(getIncrementalBackupDir(configDir), { recursive: true });
    mkdirSync(getBackupManifestsDir(configDir), { recursive: true });
}
/**
 * Generate backup filename
 */
export function generateBackupFilename(snapshot, timestamp, extension = "dump") {
    const ts = timestamp.replace(/[:.]/g, "-").replace("T", "_").split(".")[0];
    return `${snapshot}_${ts}.${extension}`;
}
/**
 * Calculate checksum of data
 */
export function calculateChecksum(data) {
    const hash = createHash("sha256");
    hash.update(data);
    return `sha256:${hash.digest("hex")}`;
}
/**
 * Register a backup
 */
export function registerBackup(configDir, metadata, filename) {
    ensureBackupDirs(configDir);
    // Save metadata
    const metadataPath = join(getBackupManifestsDir(configDir), `${metadata.snapshot}_${metadata.timestamp.replace(/[:.]/g, "-")}.json`);
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}
/**
 * Load backup metadata
 */
export function loadBackupMetadata(configDir, snapshot, timestamp) {
    const metadataPath = join(getBackupManifestsDir(configDir), `${snapshot}_${timestamp.replace(/[:.]/g, "-")}.json`);
    if (!existsSync(metadataPath)) {
        return null;
    }
    try {
        const content = readFileSync(metadataPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * List all backups
 */
export function listBackups(configDir) {
    const manifestsDir = getBackupManifestsDir(configDir);
    if (!existsSync(manifestsDir)) {
        return [];
    }
    const fs = require("fs");
    const files = fs.readdirSync(manifestsDir);
    const backups = [];
    for (const file of files) {
        if (file.endsWith(".json")) {
            try {
                const content = readFileSync(join(manifestsDir, file), "utf-8");
                const metadata = JSON.parse(content);
                const filename = generateBackupFilename(metadata.snapshot, metadata.timestamp);
                const filePath = join(getSnapshotsBackupDir(configDir), filename);
                let size = 0;
                if (existsSync(filePath)) {
                    size = statSync(filePath).size;
                }
                backups.push({
                    filename,
                    metadata,
                    filePath,
                    size,
                });
            }
            catch {
                // Skip invalid files
            }
        }
    }
    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.metadata.timestamp.localeCompare(a.metadata.timestamp));
    return backups;
}
/**
 * Get backups for a specific snapshot
 */
export function getBackupsForSnapshot(configDir, snapshot) {
    const allBackups = listBackups(configDir);
    return allBackups.filter((b) => b.metadata.snapshot === snapshot);
}
/**
 * Create backup chain
 */
export function createBackupChain(configDir, baseSnapshot) {
    const backups = listBackups(configDir);
    const baseBackup = backups.find((b) => b.metadata.snapshot === baseSnapshot);
    if (!baseBackup) {
        return null;
    }
    const chain = {
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
export function loadBackupChain(configDir, chainFile) {
    const chainPath = join(getBackupManifestsDir(configDir), chainFile);
    if (!existsSync(chainPath)) {
        return null;
    }
    try {
        const content = readFileSync(chainPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Calculate total backup size
 */
export function calculateBackupSize(configDir) {
    const backups = listBackups(configDir);
    return backups.reduce((sum, backup) => sum + backup.size, 0);
}
/**
 * Check if backup is expired based on retention policy
 */
export function isBackupExpired(metadata, now = new Date()) {
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
export function getExpiredBackups(configDir) {
    const backups = listBackups(configDir);
    const now = new Date();
    return backups.filter((b) => isBackupExpired(b.metadata, now));
}
/**
 * Parse retention policy string
 */
function parseRetentionPolicy(policy) {
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
function formatBytes(bytes) {
    if (bytes === 0)
        return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
//# sourceMappingURL=backups.js.map