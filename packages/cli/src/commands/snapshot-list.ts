import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import {
  getAllSnapshots,
  getCurrentSnapshot,
  getAllStates,
} from "@betagors/yama-core";
import { info, error, dim, fmt, printTable } from "../utils/cli-utils.ts";

interface SnapshotListOptions {
  config?: string;
}

export async function snapshotListCommand(options: SnapshotListOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const snapshots = getAllSnapshots(configDir);
    const states = getAllStates(configDir);

    if (snapshots.length === 0) {
      info("No snapshots found.");
      info("Run 'yama dev' or 'yama schema:generate' to create snapshots.");
      return;
    }

    // Get current snapshots per env
    const currentByEnv = new Map<string, string>();
    for (const state of states) {
      if (state.currentSnapshot) {
        currentByEnv.set(state.currentSnapshot, state.environment);
      }
    }

    // Sort by creation date (newest first)
    snapshots.sort((a, b) => 
      new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
    );

    console.log("");
    console.log(fmt.bold("Snapshots"));
    console.log(dim("─".repeat(50)));

    const tableData: unknown[][] = [["Hash", "Created", "Description", "Env"]];

    for (const snapshot of snapshots) {
      const hash = snapshot.hash.substring(0, 12);
      const created = new Date(snapshot.metadata.createdAt).toLocaleDateString();
      const desc = snapshot.metadata.description || "-";
      const env = currentByEnv.get(snapshot.hash) || "-";

      tableData.push([
        env !== "-" ? fmt.green(hash) : hash,
        created,
        desc.length > 30 ? desc.substring(0, 27) + "..." : desc,
        env !== "-" ? fmt.cyan(env) : dim(env),
      ]);
    }

    printTable(tableData);
    console.log("");
    console.log(dim(`Total: ${snapshots.length} snapshot(s)`));

  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
