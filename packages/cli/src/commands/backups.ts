import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import {
  listBackups,
  getBackupsForSnapshot,
  calculateBackupSize,
  getExpiredBackups,
  loadBackupMetadata,
  getSnapshotsBackupDir,
  getBackupManifestsDir,
} from "@betagors/yama-core";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { table } from "table";
import { confirm } from "../utils/interactive.ts";

interface BackupsListOptions {
  config?: string;
  snapshot?: string;
}

interface BackupsStatusOptions {
  config?: string;
}

interface BackupsCleanupOptions {
  config?: string;
  olderThan?: string;
}

export async function backupsListCommand(options: BackupsListOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const backups = options.snapshot
      ? getBackupsForSnapshot(configDir, options.snapshot)
      : listBackups(configDir);

    if (backups.length === 0) {
      info("No backups found.");
      return;
    }

    const tableData = [
      ["Snapshot", "Timestamp", "Trigger", "Size", "Compressed", "Status"],
      ...backups.map(b => [
        b.metadata.snapshot.substring(0, 8),
        new Date(b.metadata.timestamp).toLocaleString(),
        b.metadata.trigger,
        formatBytes(b.size),
        b.metadata.compressedSize || "N/A",
        "Active",
      ]),
    ];

    console.log("\n" + table(tableData));
  } catch (err) {
    error(`Failed to list backups: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export async function backupsStatusCommand(options: BackupsStatusOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const backups = listBackups(configDir);
    const totalSize = calculateBackupSize(configDir);
    const expired = getExpiredBackups(configDir);

    console.log("\n📦 Backup Status\n");
    console.log(`Total backups: ${backups.length}`);
    console.log(`Total size: ${formatBytes(totalSize)}`);
    console.log(`Expired backups: ${expired.length}`);

    if (expired.length > 0) {
      warning(`\n${expired.length} backup(s) have expired and can be cleaned up.`);
      warning("Run 'yama backups cleanup' to remove them.");
    }
  } catch (err) {
    error(`Failed to get backup status: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export async function backupsCleanupCommand(options: BackupsCleanupOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const expired = getExpiredBackups(configDir);
    
    if (expired.length === 0) {
      info("No expired backups to clean up.");
      return;
    }

    info(`Found ${expired.length} expired backup(s).`);
    
    const confirmed = await confirm("This will permanently delete backup files. Continue?", false);
    if (!confirmed) {
      info("Cleanup cancelled.");
      return;
    }
    
    let deletedCount = 0;
    const backupsDir = getSnapshotsBackupDir(configDir);
    const manifestsDir = getBackupManifestsDir(configDir);
    
    for (const backup of expired) {
      try {
        // Delete backup file
        if (existsSync(backup.filePath)) {
          unlinkSync(backup.filePath);
        }
        
        // Delete metadata file
        const metadataFile = join(
          manifestsDir,
          `${backup.metadata.snapshot}_${backup.metadata.timestamp.replace(/[:.]/g, "-")}.json`
        );
        if (existsSync(metadataFile)) {
          unlinkSync(metadataFile);
        }
        
        deletedCount++;
        info(`Deleted backup: ${backup.filename}`);
      } catch (err) {
        warning(`Failed to delete backup ${backup.filename}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    success(`Cleaned up ${deletedCount} backup(s).`);
  } catch (err) {
    error(`Failed to cleanup backups: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
