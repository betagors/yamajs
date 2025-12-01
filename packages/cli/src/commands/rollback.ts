import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  getCurrentSnapshot,
  findReversePath,
  updateState,
  loadEnvFile,
  resolveEnvVars,
} from "@betagors/yama-core";
import { info, error, success, warning, dim, fmt, createSpinner, formatDuration } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import { getDatabasePluginAndConfig } from "../utils/db-plugin.ts";

/**
 * Split SQL into statements
 */
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    current += (current ? '\n' : '') + line;
    if (trimmed.endsWith(';')) {
      if (current.trim()) statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

interface RollbackOptions {
  config?: string;
  env: string;
  to?: string;
  emergency?: boolean;
}

export async function rollbackCommand(options: RollbackOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    loadEnvFile(configPath, options.env);
    const config = resolveEnvVars(readYamaConfig(configPath)) as any;
    const configDir = getConfigDir(configPath);

    // Get current snapshot
    const currentSnapshot = getCurrentSnapshot(configDir, options.env);
    if (!currentSnapshot) {
      error(`No snapshot found for ${options.env}.`);
      process.exit(1);
    }

    // Target
    if (!options.to) {
      error("Target required. Use --to <snapshot-hash>");
      process.exit(1);
    }

    const targetSnapshot = options.to;

    if (currentSnapshot === targetSnapshot) {
      info(`${options.env} is already at ${targetSnapshot.substring(0, 8)}.`);
      return;
    }

    // Find reverse path
    const path = findReversePath(configDir, currentSnapshot, targetSnapshot);
    if (!path) {
      error(`No path from ${currentSnapshot.substring(0, 8)} to ${targetSnapshot.substring(0, 8)}.`);
      process.exit(1);
    }

    // Show plan
    console.log("");
    console.log(fmt.bold(`Rollback ${options.env}`));
    console.log(dim("─".repeat(35)));
    console.log(`Current: ${fmt.cyan(currentSnapshot.substring(0, 8))}`);
    console.log(`Target:  ${targetSnapshot.substring(0, 8)}`);
    console.log(`Steps:   ${path.transitions.length}`);
    console.log("");

    // Emergency mode warning
    if (options.emergency) {
      warning("EMERGENCY ROLLBACK MODE");
      warning("This will rollback immediately without additional checks.");
      console.log("");
    }

    // Confirm
    const message = options.emergency ? "Type 'ROLLBACK' to confirm:" : "Proceed with rollback?";
    const confirmed = await confirm(message, false);
    if (!confirmed) {
      info("Cancelled.");
      return;
    }

    // Execute rollback
    const spinner = createSpinner("Rolling back...");
    const startTime = Date.now();

    const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
    await dbPlugin.client.initDatabase(dbConfig);
    const sql = dbPlugin.client.getSQL();

    try {
      // Apply transitions in reverse
      const reversedTransitions = [...path.transitions].reverse();

      for (const transition of reversedTransitions) {
        // Generate reverse steps
        const rollbackSteps = transition.steps.map((step: any) => {
          switch (step.type) {
            case "add_table":
              return { type: "drop_table", table: step.table };
            case "add_column":
              return { type: "drop_column", table: step.table, column: step.column.name };
            case "add_index":
              return { type: "drop_index", table: step.table, index: step.index.name };
            case "add_foreign_key":
              return { type: "drop_foreign_key", table: step.table, foreignKey: step.foreignKey.name };
            default:
              return null; // Can't auto-reverse drop/modify
          }
        }).filter((s: any) => s !== null);

        if (rollbackSteps.length > 0) {
          const rollbackSQL = dbPlugin.migrations.generateFromSteps(rollbackSteps);
          
          if (rollbackSQL.trim()) {
            await sql.begin(async (tx: any) => {
              const statements = splitSQLStatements(rollbackSQL);
              for (const stmt of statements) {
                if (stmt.trim()) await tx.unsafe(stmt);
              }
            });
          }
        }
      }

      // Update state
      updateState(configDir, options.env, targetSnapshot);

      const duration = Date.now() - startTime;
      spinner.succeed(`Rolled back in ${formatDuration(duration)}`);
      console.log("");
      success(`${options.env} → ${targetSnapshot.substring(0, 8)}`);

    } catch (err) {
      spinner.fail("Rollback failed");
      error(`${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    } finally {
      dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
