import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  createSnapshot,
  saveSnapshot,
  getCurrentSnapshot,
  updateState,
  snapshotExists,
  resolveEnvVars,
  loadEnvFile,
  entitiesToModel,
} from "@betagors/yama-core";
import { info, error, success, dim, fmt } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";

interface SnapshotCreateOptions {
  config?: string;
  description?: string;
  env?: string;
}

export async function snapshotCreateCommand(options: SnapshotCreateOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    
    const config = resolveEnvVars(readYamaConfig(configPath)) as any;
    const configDir = getConfigDir(configPath);

    // Extract entities from schemas
    const entities = extractEntitiesFromSchemas(config.schemas);
    if (!entities || Object.keys(entities).length === 0) {
      error("No entities found. Add schemas with 'database:' property.");
      process.exit(1);
    }

    const normalizedEntities = normalizeEntities(entities);

    // Get current snapshot
    const currentSnapshotHash = getCurrentSnapshot(configDir, environment);

    // Create snapshot
    const newSnapshot = createSnapshot(
      normalizedEntities,
      {
        createdAt: new Date().toISOString(),
        createdBy: process.env.USER || "yama",
        description: options.description || "Manual snapshot",
      },
      currentSnapshotHash || undefined
    );

    // Check if exists
    if (snapshotExists(configDir, newSnapshot.hash)) {
      info(`Snapshot ${newSnapshot.hash.substring(0, 8)} already exists.`);
      info("No schema changes detected.");
      return;
    }

    // Show what will be created
    console.log("");
    console.log(fmt.bold("Create Snapshot"));
    console.log(dim("─".repeat(35)));
    console.log(`Hash:   ${fmt.cyan(newSnapshot.hash.substring(0, 12))}`);
    console.log(`Parent: ${currentSnapshotHash ? currentSnapshotHash.substring(0, 12) : dim("none")}`);
    console.log(`Env:    ${environment}`);
    console.log("");

    const confirmed = await confirm("Create snapshot?", true);
    if (!confirmed) {
      info("Cancelled.");
      return;
    }

    // Save
    saveSnapshot(configDir, newSnapshot);
    updateState(configDir, environment, newSnapshot.hash);

    success(`Created: ${newSnapshot.hash.substring(0, 12)}`);

  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Helper functions
function extractEntitiesFromSchemas(schemas: any): any {
  const entities: any = {};
  if (!schemas) return entities;
  for (const [name, def] of Object.entries(schemas)) {
    if (def && typeof def === 'object' && 'database' in (def as any)) {
      entities[name] = def;
    }
  }
  return entities;
}

function normalizeEntities(entities: any): any {
  const normalized: any = {};
  for (const [name, def] of Object.entries(entities)) {
    const d = def as any;
    const dbConfig = typeof d.database === "string" ? { table: d.database } : d.database;
    const tableName = dbConfig?.table || d.table || name.toLowerCase();
    normalized[name] = { ...d, table: tableName, database: dbConfig || { table: tableName } };
  }
  return normalized;
}
