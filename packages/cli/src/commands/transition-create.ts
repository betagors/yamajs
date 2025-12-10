import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  createSnapshot,
  saveSnapshot,
  loadSnapshot,
  createTransition,
  saveTransition,
  snapshotExists,
  resolveEnvVars,
  loadEnvFile,
  entitiesToModel,
  computeDiff,
  diffToSteps,
  getCurrentSnapshot,
} from "@betagors/yama-core";
import { info, error, success } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";

interface TransitionCreateOptions {
  config?: string;
  from?: string;
  to?: string;
  description?: string;
}

export async function transitionCreateCommand(options: TransitionCreateOptions): Promise<void> {
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

    let fromHash: string | undefined;
    let toHash: string;

    // Determine source snapshot
    if (options.from) {
      fromHash = options.from;
      if (!snapshotExists(configDir, fromHash)) {
        error(`Source snapshot not found: ${fromHash}`);
        process.exit(1);
      }
    } else {
      // Use current snapshot
      fromHash = getCurrentSnapshot(configDir, "development");
      if (!fromHash) {
        info("No current snapshot found. Creating initial snapshot...");
        const initialSnapshot = createSnapshot(
          resolvedConfig.entities,
          {
            createdAt: new Date().toISOString(),
            createdBy: process.env.USER || "system",
            description: "Initial snapshot",
          }
        );
        saveSnapshot(configDir, initialSnapshot);
        fromHash = initialSnapshot.hash;
        info(`Created initial snapshot: ${fromHash.substring(0, 8)}...`);
      }
    }

    // Determine target snapshot
    if (options.to) {
      toHash = options.to;
      if (!snapshotExists(configDir, toHash)) {
        error(`Target snapshot not found: ${toHash}`);
        process.exit(1);
      }
    } else {
      // Create snapshot from current yama.yaml
      const newSnapshot = createSnapshot(
        resolvedConfig.entities,
        {
          createdAt: new Date().toISOString(),
          createdBy: process.env.USER || "system",
          description: "Snapshot for transition",
        },
        fromHash
      );

      // Check if snapshot already exists
      if (snapshotExists(configDir, newSnapshot.hash)) {
        toHash = newSnapshot.hash;
        info(`Using existing snapshot: ${toHash.substring(0, 8)}...`);
      } else {
        saveSnapshot(configDir, newSnapshot);
        toHash = newSnapshot.hash;
        success(`Created snapshot: ${toHash.substring(0, 8)}...`);
      }
    }

    // Load snapshots
    const fromSnapshot = loadSnapshot(configDir, fromHash);
    if (!fromSnapshot) {
      error(`Failed to load source snapshot: ${fromHash}`);
      process.exit(1);
    }

    const toSnapshot = loadSnapshot(configDir, toHash);
    if (!toSnapshot) {
      error(`Failed to load target snapshot: ${toHash}`);
      process.exit(1);
    }

    // Compute diff and steps
    const fromModel = entitiesToModel(fromSnapshot.entities);
    const toModel = entitiesToModel(toSnapshot.entities);
    const diff = computeDiff(fromModel, toModel);
    const steps = diffToSteps(diff, fromModel, toModel);

    if (steps.length === 0) {
      info("No changes detected between snapshots.");
      return;
    }

    // Create transition
    const transition = createTransition(
      fromHash,
      toHash,
      steps,
      {
        description: options.description || "Manual transition",
        createdAt: new Date().toISOString(),
      }
    );

    // Confirm creation
    const confirmed = await confirm(
      `Create transition ${fromHash.substring(0, 8)}... -> ${toHash.substring(0, 8)}... with ${steps.length} step(s)?`,
      true
    );

    if (!confirmed) {
      info("Transition creation cancelled.");
      return;
    }

    // Save transition
    saveTransition(configDir, transition);
    success(`Transition created: ${fromHash.substring(0, 8)}... -> ${toHash.substring(0, 8)}...`);
    info(`Steps: ${steps.length}`);
  } catch (err) {
    error(`Failed to create transition: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
