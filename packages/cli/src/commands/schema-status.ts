import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import type { DatabaseConfig } from "@betagors/yama-core";
import {
  getCurrentSnapshot,
  getAllStates,
  getAllSnapshots,
  getAllTransitions,
  entitiesToModel,
  snapshotExists,
} from "@betagors/yama-core";
import { getDatabasePluginAndConfig } from "../utils/db-plugin.ts";
import { success, error, info, dim, fmt, printTable, colors } from "../utils/cli-utils.ts";

interface SchemaStatusOptions {
  config?: string;
  short?: boolean;
  env?: string;
}

export async function schemaStatusCommand(options: SchemaStatusOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      schemas?: any;
      plugins?: Record<string, Record<string, unknown>> | string[];
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;
    const configDir = getConfigDir(configPath);

    // Get current snapshot for the environment
    const currentSnapshot = getCurrentSnapshot(configDir, environment);
    
    // Get target model from config
    const entities = extractEntitiesFromSchemas(config.schemas);
    const normalizedEntities = normalizeEntities(entities);
    const targetModel = Object.keys(normalizedEntities).length > 0 
      ? entitiesToModel(normalizedEntities)
      : null;

    // Get all snapshots and transitions
    const snapshots = getAllSnapshots(configDir);
    const transitions = getAllTransitions(configDir);
    const states = getAllStates(configDir);

    if (options.short) {
      const inSync = targetModel && currentSnapshot === targetModel.hash;
      if (inSync) {
        console.log(`${environment}: ${colors.success("in sync")} (${currentSnapshot?.substring(0, 8) || "none"})`);
      } else {
        console.log(`${environment}: ${colors.warning("out of sync")}`);
      }
      return;
    }

    // Full status display
    console.log("");
    console.log(fmt.bold("Schema Status"));
    console.log(dim("─".repeat(40)));
    console.log("");

    // Environment state
    const inSync = targetModel && currentSnapshot === targetModel.hash;
    console.log(fmt.bold("Environment:"), environment);
    console.log(fmt.bold("Current:"), currentSnapshot ? fmt.cyan(currentSnapshot.substring(0, 8)) : dim("none"));
    console.log(fmt.bold("Target:"), targetModel ? fmt.cyan(targetModel.hash.substring(0, 8)) : dim("none"));
    console.log(fmt.bold("Status:"), inSync ? fmt.green("✓ In sync") : fmt.yellow("○ Changes pending"));
    console.log("");

    // All environments
    if (states.length > 0) {
      console.log(fmt.bold("All Environments"));
      console.log(dim("─".repeat(40)));
      
      const tableData: unknown[][] = [["Env", "Snapshot", "Updated"]];
      for (const state of states) {
        const isTarget = targetModel && state.currentSnapshot === targetModel.hash;
        const snapshotDisplay = state.currentSnapshot 
          ? `${state.currentSnapshot.substring(0, 8)}${isTarget ? " ✓" : ""}`
          : "-";
        tableData.push([
          state.environment,
          snapshotDisplay,
          new Date(state.updatedAt).toLocaleDateString(),
        ]);
      }
      printTable(tableData);
      console.log("");
    }

    // Snapshots
    if (snapshots.length > 0) {
      console.log(fmt.bold(`Snapshots (${snapshots.length})`));
      console.log(dim("─".repeat(40)));
      
      const tableData: unknown[][] = [["Hash", "Description", "Created"]];
      for (const snapshot of snapshots.slice(-5)) { // Show last 5
        const isCurrent = snapshot.hash === currentSnapshot;
        const isTarget = targetModel && snapshot.hash === targetModel.hash;
        const markers = [isCurrent ? "current" : "", isTarget ? "target" : ""].filter(Boolean).join(", ");
        tableData.push([
          `${snapshot.hash.substring(0, 8)}${markers ? ` (${markers})` : ""}`,
          snapshot.metadata.description || "-",
          new Date(snapshot.metadata.createdAt).toLocaleDateString(),
        ]);
      }
      printTable(tableData);
      
      if (snapshots.length > 5) {
        console.log(dim(`  ... and ${snapshots.length - 5} more`));
      }
      console.log("");
    }

    // Transitions
    if (transitions.length > 0) {
      console.log(fmt.bold(`Transitions (${transitions.length})`));
      console.log(dim("─".repeat(40)));
      
      const tableData: unknown[][] = [["From", "To", "Steps"]];
      for (const transition of transitions.slice(-5)) { // Show last 5
        tableData.push([
          transition.fromHash ? transition.fromHash.substring(0, 8) : "empty",
          transition.toHash.substring(0, 8),
          transition.steps.length.toString(),
        ]);
      }
      printTable(tableData);
      
      if (transitions.length > 5) {
        console.log(dim(`  ... and ${transitions.length - 5} more`));
      }
      console.log("");
    }

    // Next steps
    if (!inSync && targetModel) {
      info(`Run 'yama deploy --env ${environment}' to apply changes.`);
    } else if (inSync) {
      success("Schema is up to date.");
    }

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
