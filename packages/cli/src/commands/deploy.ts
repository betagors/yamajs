import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  getCurrentSnapshot,
  findPath,
  loadTransition,
  assessTransition,
  analyzeImpact,
  getSafetySummary,
  SafetyLevel,
  isSafeForAutoDeploy,
  requiresApproval,
  loadEnvFile,
  resolveEnvVars,
} from "@betagors/yama-core";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";

interface DeployOptions {
  config?: string;
  env: string;
  plan?: boolean;
  dryRun?: boolean;
  autoRollback?: boolean;
}

export async function deployCommand(options: DeployOptions): Promise<void> {
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

    if (!resolvedConfig.entities) {
      error("No entities found in yama.yaml");
      process.exit(1);
    }

    // Get current snapshot for environment
    const currentSnapshot = getCurrentSnapshot(configDir, options.env);
    if (!currentSnapshot) {
      error(`No current snapshot found for environment: ${options.env}`);
      error("Run 'yama dev' first to create initial snapshot.");
      process.exit(1);
    }

    // Get target snapshot (from current yama.yaml)
    const { createSnapshot, entitiesToModel } = await import("@betagors/yama-core");
    const targetSnapshot = createSnapshot(
      resolvedConfig.entities,
      {
        createdAt: new Date().toISOString(),
        createdBy: "deploy",
        description: `Deployment to ${options.env}`,
      },
      currentSnapshot
    );

    if (currentSnapshot === targetSnapshot.hash) {
      success(`Environment '${options.env}' is already up to date.`);
      return;
    }

    // Find path to target
    const path = findPath(configDir, currentSnapshot, targetSnapshot.hash);
    if (!path) {
      error(`No path found from ${currentSnapshot.substring(0, 8)} to ${targetSnapshot.hash.substring(0, 8)}`);
      error("This may indicate a schema conflict. Run 'yama resolve' to merge changes.");
      process.exit(1);
    }

    // Assess safety
    const transitions = path.transitions;
    let overallLevel = SafetyLevel.SAFE;
    for (const transition of transitions) {
      const assessment = assessTransition(transition);
      if (assessment.level === SafetyLevel.DANGEROUS) {
        overallLevel = SafetyLevel.DANGEROUS;
        break;
      } else if (assessment.level === SafetyLevel.REVIEW && overallLevel === SafetyLevel.SAFE) {
        overallLevel = SafetyLevel.REVIEW;
      }
    }

    const impact = analyzeImpact(transitions[0]); // Use first transition for impact
    const summary = getSafetySummary(transitions[0]);

    // Show deployment plan
    console.log("\n🚀 Deployment Plan\n");
    console.log(`Environment: ${options.env}`);
    console.log(`Current: ${currentSnapshot.substring(0, 8)}...`);
    console.log(`Target: ${targetSnapshot.hash.substring(0, 8)}...`);
    console.log(`Transitions: ${transitions.length}`);
    console.log(`\nSafety: ${overallLevel}`);
    console.log(`Impact:`);
    console.log(`  Tables: ${impact.tables.join(", ")}`);
    console.log(`  Downtime: ${impact.downtime}`);
    console.log(`  Requires backup: ${impact.requiresBackup ? "Yes" : "No"}`);
    console.log(`\n${summary.summary}`);

    if (options.plan) {
      return; // Just show plan, don't deploy
    }

    // Check if approval needed
    if (overallLevel !== SafetyLevel.SAFE && !options.dryRun) {
      warning("\n⚠️  This deployment requires approval.");
      const approved = await confirm("Continue with deployment?", false);
      if (!approved) {
        info("Deployment cancelled.");
        return;
      }
    }

    if (options.dryRun) {
      success("\n✅ Dry run complete. No changes were made.");
      return;
    }

    // Deploy
    info("\nDeploying...");
    
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
      
      // Apply each transition
      for (const transition of transitions) {
        info(`Applying transition ${transition.hash.substring(0, 8)}...`);
        
        // Generate SQL from steps
        const sqlStatements = dbPlugin.migrations.generateFromSteps(transition.steps);
        
        if (sqlStatements.trim()) {
          // Execute in transaction
          await sql.begin(async (tx: any) => {
            await tx.unsafe(sqlStatements);
            
            // Record transition application
            await tx.unsafe(`
              INSERT INTO _yama_migrations (
                name, type, from_model_hash, to_model_hash, checksum, description
              ) VALUES (
                'transition_${transition.hash}',
                'schema',
                '${transition.fromHash}',
                '${transition.toHash}',
                '${transition.hash}',
                ${transition.metadata.description ? `'${transition.metadata.description.replace(/'/g, "''")}'` : 'NULL'}
              )
              ON CONFLICT (name) DO NOTHING
            `);
          });
        }
      }
      
      // Update state
      const { updateState } = await import("@betagors/yama-core");
      updateState(configDir, options.env, targetSnapshot.hash);
      
      success(`\n✅ Deployment successful!`);
      success(`Environment '${options.env}' is now at: ${targetSnapshot.hash.substring(0, 8)}...`);
    } catch (err) {
      error(`Deployment failed: ${err instanceof Error ? err.message : String(err)}`);
      if (options.autoRollback) {
        warning("Auto-rollback triggered...");
        try {
          // Rollback to previous state
          const { rollbackCommand } = await import("./rollback.ts");
          await rollbackCommand({
            config: options.config,
            env: options.env,
            to: currentSnapshot,
          });
        } catch (rollbackErr) {
          error(`Auto-rollback failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`);
        }
      }
      process.exit(1);
    } finally {
      dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Failed to deploy: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}













