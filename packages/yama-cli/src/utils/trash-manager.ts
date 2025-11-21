import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync } from "fs";
import { join } from "path";
import { TrashEntry, calculateExpirationDate, isExpired, DEFAULT_RETENTION_DAYS } from "@yama/core";
import { success, error, info, warning, colors } from "./cli-utils.js";

/**
 * Trash manager for migrations and data snapshots
 */
export class TrashManager {
  private trashDir: string;

  constructor(trashDir: string) {
    this.trashDir = trashDir;
    this.ensureTrashDir();
  }

  private ensureTrashDir(): void {
    if (!existsSync(this.trashDir)) {
      mkdirSync(this.trashDir, { recursive: true });
    }
  }

  /**
   * Move file to trash
   */
  moveToTrash(
    filePath: string,
    type: TrashEntry["type"],
    metadata?: TrashEntry["metadata"]
  ): TrashEntry {
    const fileName = require("path").basename(filePath);
    const timestamp = Date.now();
    const trashFileName = `${timestamp}_${fileName}`;
    const trashPath = join(this.trashDir, trashFileName);

    // Move file
    if (existsSync(filePath)) {
      renameSync(filePath, trashPath);
    } else {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create trash entry
    const entry: TrashEntry = {
      id: `${timestamp}_${fileName}`,
      type,
      name: fileName,
      original_path: filePath,
      trash_path: trashPath,
      deleted_at: new Date(),
      expires_at: calculateExpirationDate(DEFAULT_RETENTION_DAYS),
      metadata: metadata || {},
    };

    // Save entry metadata
    const entryPath = join(this.trashDir, `${trashFileName}.meta.json`);
    writeFileSync(entryPath, JSON.stringify(entry, null, 2), "utf-8");

    return entry;
  }

  /**
   * Restore file from trash
   */
  restoreFromTrash(entryId: string): TrashEntry {
    const entry = this.getEntry(entryId);
    
    if (!entry) {
      throw new Error(`Trash entry not found: ${entryId}`);
    }

    if (isExpired(entry)) {
      throw new Error(`Trash entry expired: ${entryId}`);
    }

    // Restore file
    if (existsSync(entry.trash_path)) {
      renameSync(entry.trash_path, entry.original_path);
    } else {
      throw new Error(`Trash file not found: ${entry.trash_path}`);
    }

    // Remove metadata
    const entryPath = join(this.trashDir, `${entryId}.meta.json`);
    if (existsSync(entryPath)) {
      unlinkSync(entryPath);
    }

    return entry;
  }

  /**
   * Get trash entry by ID
   */
  getEntry(entryId: string): TrashEntry | null {
    const entryPath = join(this.trashDir, `${entryId}.meta.json`);
    if (!existsSync(entryPath)) {
      return null;
    }

    try {
      const content = readFileSync(entryPath, "utf-8");
      const entry = JSON.parse(content) as TrashEntry;
      // Convert date strings back to Date objects
      entry.deleted_at = new Date(entry.deleted_at);
      entry.expires_at = new Date(entry.expires_at);
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * List all trash entries
   */
  listEntries(): TrashEntry[] {
    const entries: TrashEntry[] = [];

    if (!existsSync(this.trashDir)) {
      return entries;
    }

    const files = readdirSync(this.trashDir)
      .filter((f) => f.endsWith(".meta.json"))
      .map((f) => f.replace(".meta.json", ""));

    for (const fileId of files) {
      const entry = this.getEntry(fileId);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries.sort((a, b) => b.deleted_at.getTime() - a.deleted_at.getTime());
  }

  /**
   * Permanently delete trash entry
   */
  permanentlyDelete(entryId: string): void {
    const entry = this.getEntry(entryId);
    if (!entry) {
      throw new Error(`Trash entry not found: ${entryId}`);
    }

    // Delete file
    if (existsSync(entry.trash_path)) {
      unlinkSync(entry.trash_path);
    }

    // Delete metadata
    const entryPath = join(this.trashDir, `${entryId}.meta.json`);
    if (existsSync(entryPath)) {
      unlinkSync(entryPath);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(dryRun: boolean = false): { deleted: number; total: number } {
    const entries = this.listEntries();
    const expired = entries.filter(isExpired);
    
    let deleted = 0;
    for (const entry of expired) {
      if (!dryRun) {
        this.permanentlyDelete(entry.id);
      }
      deleted++;
    }

    return { deleted, total: expired.length };
  }

  /**
   * Get trash statistics
   */
  getStats(): {
    total: number;
    active: number;
    expired: number;
    totalSize: number;
  } {
    const entries = this.listEntries();
    const expired = entries.filter(isExpired);
    
    let totalSize = 0;
    for (const entry of entries) {
      if (existsSync(entry.trash_path)) {
        try {
          const stats = statSync(entry.trash_path);
          totalSize += stats.size;
        } catch {
          // Ignore errors
        }
      }
    }

    return {
      total: entries.length,
      active: entries.length - expired.length,
      expired: expired.length,
      totalSize,
    };
  }
}

