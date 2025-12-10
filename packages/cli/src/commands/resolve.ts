import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  loadSnapshot,
  createSnapshot,
  saveSnapshot,
  createTransition,
  saveTransition,
  mergeMigrationSchemas,
  createMergeSnapshot,
  entitiesToModel,
  computeDiff,
  diffToSteps,
  resolveEnvVars,
  loadEnvFile,
} from "@betagors/yama-core";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";

interface ResolveOptions {
  config?: string;
  base?: string;
  local?: string;
  remote?: string;
}

export async function resolveCommand(options: ResolveOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    loadEnvFile(configPath);
    const config = readYamaConfig(configPath) as any;
    const resolvedConfig = resolveEnvVars(config) as any;
    const configDir = getConfigDir(configPath);

    if (!resolvedConfig.entities) {
      error("No entities found in yama.yaml");
      process.exit(1);
    }

    // Determine snapshots
    let baseHash: string | undefined;
    let localHash: string | undefined;
    let remoteHash: string | undefined;

    if (options.base) {
      baseHash = options.base;
    }
    if (options.local) {
      localHash = options.local;
    }
    if (options.remote) {
      remoteHash = options.remote;
    }

    // If not provided, try to infer from current state
    // This is a simplified version - in practice, you'd detect git merge conflicts
    if (!baseHash || !localHash || !remoteHash) {
      info("Attempting to resolve merge conflict...");
      info("Note: For full merge conflict resolution, provide --base, --local, and --remote options");
      
      // Use current yama.yaml as "local"
      const currentSnapshot = createSnapshot(
        resolvedConfig.entities,
        {
          createdAt: new Date().toISOString(),
          createdBy: process.env.USER || "system",
          description: "Current state",
        }
      );
      
      // This is a simplified merge - in practice, you'd load actual base/local/remote
      warning("Full merge conflict resolution requires explicit snapshot hashes.");
      info("Use: yama resolve --base <hash> --local <hash> --remote <hash>");
      return;
    }

    // Load snapshots
    const baseSnapshot = baseHash ? loadSnapshot(configDir, baseHash) : null;
    const localSnapshot = localHash ? loadSnapshot(configDir, localHash) : null;
    const remoteSnapshot = remoteHash ? loadSnapshot(configDir, remoteHash) : null;

    if (!baseSnapshot || !localSnapshot || !remoteSnapshot) {
      error("Failed to load required snapshots");
      if (!baseSnapshot) error(`Base snapshot not found: ${baseHash}`);
      if (!localSnapshot) error(`Local snapshot not found: ${localHash}`);
      if (!remoteSnapshot) error(`Remote snapshot not found: ${remoteHash}`);
      process.exit(1);
    }

    // Perform merge
    info("Merging schemas...");
    const mergeResult = mergeMigrationSchemas(
      baseSnapshot.entities,
      localSnapshot.entities,
      remoteSnapshot.entities
    );

    if (!mergeResult.success || !mergeResult.merged) {
      error("Conflicts detected that cannot be auto-merged:");
      for (const conflict of mergeResult.conflicts) {
        error(`  - ${conflict.type}: ${conflict.entity}${conflict.field ? `.${conflict.field}` : ""}`);
        error(`    Description: ${conflict.description}`);
        error(`    Local: ${conflict.localChange}`);
        error(`    Remote: ${conflict.remoteChange}`);
      }
      error("Please resolve conflicts manually in yama.yaml");
      process.exit(1);
    }

    // Create merge snapshot
    const mergedSnapshot = createMergeSnapshot(
      configDir,
      baseHash,
      localHash,
      remoteHash,
      mergeResult.merged,
      {
        createdAt: new Date().toISOString(),
        createdBy: process.env.USER || "system",
        description: "Merged snapshot",
      }
    );

    // Save merge snapshot
    saveSnapshot(configDir, mergedSnapshot);
    success(`Merge snapshot created: ${mergedSnapshot.hash.substring(0, 8)}...`);

    // Create transitions
    const localModel = entitiesToModel(localSnapshot.entities);
    const remoteModel = entitiesToModel(remoteSnapshot.entities);
    const mergedModel = entitiesToModel(mergedSnapshot.entities);

    // Transition from local to merged
    const localDiff = computeDiff(localModel, mergedModel);
    const localSteps = diffToSteps(localDiff, localModel, mergedModel);
    if (localSteps.length > 0) {
      const localTransition = createTransition(
        localHash,
        mergedSnapshot.hash,
        localSteps,
        {
          description: "Merge transition from local",
          createdAt: new Date().toISOString(),
        }
      );
      saveTransition(configDir, localTransition);
      info(`Created transition: ${localHash.substring(0, 8)}... -> ${mergedSnapshot.hash.substring(0, 8)}...`);
    }

    // Transition from remote to merged
    const remoteDiff = computeDiff(remoteModel, mergedModel);
    const remoteSteps = diffToSteps(remoteDiff, remoteModel, mergedModel);
    if (remoteSteps.length > 0) {
      const remoteTransition = createTransition(
        remoteHash,
        mergedSnapshot.hash,
        remoteSteps,
        {
          description: "Merge transition from remote",
          createdAt: new Date().toISOString(),
        }
      );
      saveTransition(configDir, remoteTransition);
      info(`Created transition: ${remoteHash.substring(0, 8)}... -> ${mergedSnapshot.hash.substring(0, 8)}...`);
    }

    success("Merge conflict resolved!");
    info(`Update yama.yaml to match snapshot ${mergedSnapshot.hash.substring(0, 8)}...`);
  } catch (err) {
    error(`Failed to resolve merge conflict: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
