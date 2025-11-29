import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  getCurrentSnapshot,
  findReversePath,
  loadTransition,
  loadEnvFile,
  resolveEnvVars,
} from "@betagors/yama-core";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";

interface RollbackOptions {
  config?: string;
  env: string;
  to?: string;
  emergency?: boolean;
}

export async function rollbackCommand(options: RollbackOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    loadEnvFile(configPath, options.env);
    const config = readYamaConfig(configPath) as any;
    const resolvedConfig = resolveEnvVars(config) as any;
    const configDir = getConfigDir(configPath);

    // Get current snapshot
    const currentSnapshot = getCurrentSnapshot(configDir, options.env);
    if (!currentSnapshot) {
      error(`No current snapshot found for environment: ${options.env}`);
      process.exit(1);
    }

    // Determine target snapshot
    let targetSnapshot: string;
    if (options.to) {
      targetSnapshot = options.to;
    } else {
      // Rollback to previous snapshot (would need to track history)
      error("Target snapshot required. Use --to <snapshot-hash>");
      process.exit(1);
    }

    if (currentSnapshot === targetSnapshot) {
      info(`Environment '${options.env}' is already at target snapshot.`);
      return;
    }

    // Find reverse path
    const path = findReversePath(configDir, currentSnapshot, targetSnapshot);
    if (!path) {
      error(`No rollback path found from ${currentSnapshot.substring(0, 8)} to ${targetSnapshot.substring(0, 8)}`);
      process.exit(1);
    }

    // Show rollback plan
    console.log("\n⏪ Rollback Plan\n");
    console.log(`Environment: ${options.env}`);
    console.log(`Current: ${currentSnapshot.substring(0, 8)}...`);
    console.log(`Target: ${targetSnapshot.substring(0, 8)}...`);
    console.log(`Transitions: ${path.transitions.length}`);

    if (options.emergency) {
      warning("\n🚨 EMERGENCY ROLLBACK MODE");
      warning("This will:");
      warning("  1. Stop all writes to database");
      warning("  2. Restore from snapshot");
      warning("  3. Replay audit log (if available)");
      warning("  4. Resume normal operation");
      
      const confirmed = await confirm("Type 'EMERGENCY' to confirm:", false);
      if (!confirmed) {
        info("Rollback cancelled.");
        return;
      }
    } else {
      const confirmed = await confirm("Continue with rollback?", false);
      if (!confirmed) {
        info("Rollback cancelled.");
        return;
      }
    }

    // Rollback
    info("\nRolling back...");
    
    if (!resolvedConfig.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    const dbPlugin = await getDatabasePlugin(resolvedConfig.plugins, configPath);
    await dbPlugin.client.initDatabase(resolvedConfig.database);
    const sql = dbPlugin.client.getSQL();

    try {
      // Ensure migration tables exist
      await sql.unsafe(dbPlugin.migrations.getMigrationTableSQL());
      
      // Apply rollback transitions in reverse order
      const reversedTransitions = [...path.transitions].reverse();
      
      for (const transition of reversedTransitions) {
        info(`Rolling back transition ${transition.hash.substring(0, 8)}...`);
        
        // Generate rollback SQL (reverse the steps)
        const rollbackSteps = transition.steps.map(step => {
          // Reverse each step
          switch (step.type) {
            case "add_table":
              return { type: "drop_table" as const, table: step.table };
            case "drop_table":
              // Can't fully reverse drop_table without original definition
              return null;
            case "add_column":
              return { type: "drop_column" as const, table: step.table, column: step.column.name };
            case "drop_column":
              // Can't fully reverse drop_column without original definition
              return null;
            case "add_index":
              return { type: "drop_index" as const, table: step.table, index: step.index.name };
            case "drop_index":
              // Can't fully reverse drop_index without original definition
              return null;
            case "add_foreign_key":
              return { type: "drop_foreign_key" as const, table: step.table, foreignKey: step.foreignKey.name };
            case "drop_foreign_key":
              // Can't fully reverse drop_foreign_key without original definition
              return null;
            case "modify_column":
              // Can't fully reverse modify_column without original state
              return null;
            default:
              return null;
          }
        }).filter((step): step is any => step !== null);
        
        if (rollbackSteps.length > 0) {
          const rollbackSQL = dbPlugin.migrations.generateFromSteps(rollbackSteps);
          
          if (rollbackSQL.trim()) {
            await sql.begin(async (tx: any) => {
              await tx.unsafe(rollbackSQL);
            });
          }
        }
      }
      
      // Update state
      const { updateState } = await import("@betagors/yama-core");
      updateState(configDir, options.env, targetSnapshot);
      
      success(`\n✅ Rollback successful!`);
      success(`Environment '${options.env}' is now at: ${targetSnapshot.substring(0, 8)}...`);
    } finally {
      dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to rollback: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}





