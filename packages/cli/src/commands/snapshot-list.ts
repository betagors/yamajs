import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import {
  getAllSnapshots,
  loadManifest,
  getManifestPath,
} from "@betagors/yama-core";
import { info, error, printTable, colors } from "../utils/cli-utils.ts";

interface SnapshotListOptions {
  config?: string;
}

export async function snapshotListCommand(options: SnapshotListOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const manifestPath = getManifestPath(configDir);

    if (!existsSync(manifestPath)) {
      info("No snapshots found.");
      return;
    }

    const manifest = loadManifest(configDir);
    const snapshots = getAllSnapshots(configDir);

    if (snapshots.length === 0) {
      info("No snapshots found.");
      return;
    }

    // Sort by creation date (newest first)
    snapshots.sort((a, b) => {
      const dateA = new Date(a.metadata.createdAt).getTime();
      const dateB = new Date(b.metadata.createdAt).getTime();
      return dateB - dateA;
    });

    const tableData: unknown[][] = [
      ["Hash", "Created", "Description", "Parent"],
    ];

    for (const snapshot of snapshots) {
      const hash = snapshot.hash.substring(0, 8) + "...";
      const createdAt = new Date(snapshot.metadata.createdAt).toLocaleString();
      const description = snapshot.metadata.description || "-";
      const parent = snapshot.metadata.parent
        ? snapshot.metadata.parent.substring(0, 8) + "..."
        : "-";

      tableData.push([hash, createdAt, description, parent]);
    }

    console.log("\n📸 Schema Snapshots:\n");
    printTable(tableData);
    console.log(`\nTotal: ${snapshots.length} snapshot(s)`);
  } catch (err) {
    error(`Failed to list snapshots: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
