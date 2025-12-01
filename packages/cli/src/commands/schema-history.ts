import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import type { DatabaseConfig } from "@betagors/yama-core";
import {
  getAllSnapshots,
  getAllTransitions,
  getCurrentSnapshot,
  getAllStates,
} from "@betagors/yama-core";
import { getDatabasePluginAndConfig } from "../utils/db-plugin.ts";
import { error, info, dim, fmt, printTable } from "../utils/cli-utils.ts";

interface SchemaHistoryOptions {
  config?: string;
  graph?: boolean;
  env?: string;
}

export async function schemaHistoryCommand(options: SchemaHistoryOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    const configDir = getConfigDir(configPath);

    // Get local snapshots and transitions
    const snapshots = getAllSnapshots(configDir);
    const transitions = getAllTransitions(configDir);
    const states = getAllStates(configDir);
    const currentSnapshot = getCurrentSnapshot(configDir, environment);

    console.log("");
    console.log(fmt.bold("Schema History"));
    console.log(dim("─".repeat(40)));
    console.log("");

    if (options.graph) {
      // Graph visualization
      console.log(fmt.bold("Transition Graph"));
      console.log("");
      
      if (transitions.length === 0) {
        info("No transitions recorded.");
      } else {
        // Build adjacency for simple visualization
        const nodes = new Set<string>();
        for (const t of transitions) {
          if (t.fromHash) nodes.add(t.fromHash);
          nodes.add(t.toHash);
        }

        // Show transitions
        for (const t of transitions) {
          const from = t.fromHash ? t.fromHash.substring(0, 8) : "empty";
          const to = t.toHash.substring(0, 8);
          const isCurrent = t.toHash === currentSnapshot;
          const marker = isCurrent ? fmt.green(" ← current") : "";
          console.log(`  ${from} → ${to}${marker}`);
          console.log(dim(`    ${t.steps.length} step(s): ${t.metadata.description || ""}`));
        }
      }
      console.log("");
      return;
    }

    // Snapshots table
    if (snapshots.length > 0) {
      console.log(fmt.bold(`Snapshots (${snapshots.length})`));
      
      const snapshotData: unknown[][] = [["Hash", "Created", "Description"]];
      
      // Sort by date descending
      snapshots.sort((a, b) => 
        new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
      );
      
      for (const s of snapshots.slice(0, 10)) {
        const isCurrent = s.hash === currentSnapshot;
        const hash = `${s.hash.substring(0, 8)}${isCurrent ? " ✓" : ""}`;
        snapshotData.push([
          hash,
          new Date(s.metadata.createdAt).toLocaleDateString(),
          s.metadata.description || "-",
        ]);
      }
      
      printTable(snapshotData);
      if (snapshots.length > 10) {
        console.log(dim(`  ... and ${snapshots.length - 10} more`));
      }
      console.log("");
    }

    // Transitions table
    if (transitions.length > 0) {
      console.log(fmt.bold(`Transitions (${transitions.length})`));
      
      const transitionData: unknown[][] = [["From", "To", "Steps", "Description"]];
      
      for (const t of transitions.slice(-10)) {
        transitionData.push([
          t.fromHash ? t.fromHash.substring(0, 8) : "empty",
          t.toHash.substring(0, 8),
          t.steps.length.toString(),
          t.metadata.description || "-",
        ]);
      }
      
      printTable(transitionData);
      if (transitions.length > 10) {
        console.log(dim(`  ... and ${transitions.length - 10} more`));
      }
      console.log("");
    }

    // Database history (if available)
    try {
      const config = resolveEnvVars(readYamaConfig(configPath)) as any;
      const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
      await dbPlugin.client.initDatabase(dbConfig);
      const sql = dbPlugin.client.getSQL();

      const dbMigrations = await sql.unsafe(`
        SELECT name, from_model_hash, to_model_hash, applied_at
        FROM _yama_migrations
        ORDER BY applied_at DESC
        LIMIT 10
      `) as any[];

      if (dbMigrations.length > 0) {
        console.log(fmt.bold("Applied Migrations (Database)"));
        
        const dbData: unknown[][] = [["Name", "From", "To", "Applied"]];
        for (const m of dbMigrations) {
          dbData.push([
            m.name.replace("transition_", "").substring(0, 20),
            m.from_model_hash ? m.from_model_hash.substring(0, 8) : "-",
            m.to_model_hash ? m.to_model_hash.substring(0, 8) : "-",
            new Date(m.applied_at).toLocaleDateString(),
          ]);
        }
        printTable(dbData);
      }

      await dbPlugin.client.closeDatabase();
    } catch {
      // No database connection or table - skip DB history
    }

    // Environment states
    if (states.length > 0) {
      console.log("");
      console.log(fmt.bold("Environment States"));
      for (const state of states) {
        const marker = state.environment === environment ? " ←" : "";
        console.log(`  ${state.environment}: ${state.currentSnapshot?.substring(0, 8) || dim("none")}${marker}`);
      }
    }

    console.log("");
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
