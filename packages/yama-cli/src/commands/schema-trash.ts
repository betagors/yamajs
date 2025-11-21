import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.js";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.js";
import { TrashManager } from "../utils/trash-manager.js";
import { success, error, info, warning, printTable, colors, formatSize } from "../utils/cli-utils.js";
import { confirm } from "../utils/interactive.js";

interface SchemaTrashOptions {
  config?: string;
  list?: boolean;
  restore?: string;
  delete?: string;
  cleanup?: boolean;
  dryRun?: boolean;
}

export async function schemaTrashCommand(options: SchemaTrashOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const configDir = getConfigDir(configPath);
  const trashDir = join(configDir, ".yama-trash");
  const manager = new TrashManager(trashDir);

  try {
    if (options.list || (!options.restore && !options.delete && !options.cleanup)) {
      // List trash entries
      const entries = manager.listEntries();
      const stats = manager.getStats();

      if (entries.length === 0) {
        info("Trash is empty");
        return;
      }

      console.log(`\n🗑️  Trash (${stats.total} items, ${formatSize(stats.totalSize)})\n`);

      const tableData: unknown[][] = [
        ["ID", "Name", "Type", "Deleted", "Expires", "Status"],
      ];

      for (const entry of entries) {
        const status = entry.expires_at < new Date()
          ? colors.error("Expired")
          : colors.warning("Active");
        const daysLeft = Math.ceil(
          (entry.expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        tableData.push([
          entry.id.substring(0, 12) + "...",
          entry.name,
          entry.type,
          entry.deleted_at.toISOString().split("T")[0],
          daysLeft > 0 ? `${daysLeft}d left` : "Expired",
          status,
        ]);
      }

      printTable(tableData);

      if (stats.expired > 0) {
        warning(`\n${stats.expired} expired item(s). Run 'yama schema:trash --cleanup' to remove them.`);
      }
    } else if (options.restore) {
      // Restore from trash
      const entry = manager.getEntry(options.restore);
      if (!entry) {
        error(`Trash entry not found: ${options.restore}`);
        process.exit(1);
      }

      if (entry.expires_at < new Date()) {
        error(`Trash entry expired: ${options.restore}`);
        process.exit(1);
      }

      const confirmed = await confirm(
        `Restore ${entry.name} to ${entry.original_path}?`,
        false
      );

      if (!confirmed) {
        info("Restore cancelled");
        return;
      }

      manager.restoreFromTrash(options.restore);
      success(`Restored: ${entry.name}`);
    } else if (options.delete) {
      // Permanently delete
      const entry = manager.getEntry(options.delete);
      if (!entry) {
        error(`Trash entry not found: ${options.delete}`);
        process.exit(1);
      }

      const confirmed = await confirm(
        `Permanently delete ${entry.name}? This cannot be undone.`,
        false
      );

      if (!confirmed) {
        info("Delete cancelled");
        return;
      }

      manager.permanentlyDelete(options.delete);
      success(`Deleted: ${entry.name}`);
    } else if (options.cleanup) {
      // Cleanup expired
      const result = manager.cleanupExpired(options.dryRun || false);

      if (result.total === 0) {
        info("No expired items to clean up");
        return;
      }

      if (options.dryRun) {
        info(`Would delete ${result.total} expired item(s)`);
      } else {
        const confirmed = await confirm(
          `Delete ${result.total} expired item(s)?`,
          false
        );

        if (!confirmed) {
          info("Cleanup cancelled");
          return;
        }

        manager.cleanupExpired(false);
        success(`Cleaned up ${result.total} expired item(s)`);
      }
    }
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

