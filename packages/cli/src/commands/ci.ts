import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  loadSnapshot,
  entitiesToModel,
  computeDiff,
  diffToSteps,
  assessTransition,
  analyzeImpact,
  getSafetySummary,
  SafetyLevel,
  getCurrentSnapshot,
  createSnapshot,
  createTransition,
  resolveEnvVars,
  loadEnvFile,
} from "@betagors/yama-core";
import { info, error, success, warning } from "../utils/cli-utils.ts";

interface CIAnalyzeOptions {
  config?: string;
  from?: string;
  to?: string;
  output?: string;
}

interface CIValidateOptions {
  config?: string;
}

export async function ciAnalyzeCommand(options: CIAnalyzeOptions): Promise<void> {
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
    let fromHash: string | undefined;
    let toHash: string;

    if (options.from) {
      fromHash = options.from;
    } else {
      fromHash = getCurrentSnapshot(configDir, "development");
    }

    if (options.to) {
      toHash = options.to;
    } else {
      // Create snapshot from current yama.yaml
      const newSnapshot = createSnapshot(
        resolvedConfig.entities,
        {
          createdAt: new Date().toISOString(),
          createdBy: "ci",
          description: "CI analysis snapshot",
        },
        fromHash
      );
      toHash = newSnapshot.hash;
    }

    if (!fromHash) {
      info("No previous snapshot found. This appears to be an initial schema.");
      return;
    }

    // Load snapshots and compute diff
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

    const fromModel = entitiesToModel(fromSnapshot.entities);
    const toModel = entitiesToModel(toSnapshot.entities);
    const diff = computeDiff(fromModel, toModel);
    const steps = diffToSteps(diff, fromModel, toModel);

    // Create transition for analysis
    const transition = createTransition(
      fromHash,
      toHash,
      steps,
      {
        description: "CI analysis transition",
        createdAt: new Date().toISOString(),
      }
    );

    // Assess safety
    const assessment = assessTransition(transition);
    const impact = analyzeImpact(transition);
    const summary = getSafetySummary(transition);

    // Output results
    const outputFormat = options.output || "text";

    if (outputFormat === "json") {
      console.log(JSON.stringify({
        summary,
        assessment,
        impact,
        transition: {
          from: fromHash,
          to: toHash,
          steps: steps.length,
        },
      }, null, 2));
    } else {
      console.log("\n🔍 Schema Change Analysis\n");
      console.log(`From: ${fromHash.substring(0, 8)}...`);
      console.log(`To: ${toHash.substring(0, 8)}...`);
      console.log(`Steps: ${steps.length}\n`);

      console.log("Safety Assessment:");
      const safetyEmoji = assessment.level === SafetyLevel.SAFE ? "✅" :
                          assessment.level === SafetyLevel.REVIEW ? "⚠️" : "🚨";
      console.log(`  ${safetyEmoji} Level: ${assessment.level}`);
      if (assessment.reasons.length > 0) {
        console.log("  Reasons:");
        assessment.reasons.forEach(reason => {
          console.log(`    - ${reason}`);
        });
      }

      console.log("\nImpact Analysis:");
      console.log(`  Tables affected: ${impact.tables.length}`);
      console.log(`  Estimated rows: ${impact.estimatedRows}`);
      console.log(`  Downtime: ${impact.downtime}`);
      console.log(`  Requires backup: ${impact.requiresBackup ? "Yes" : "No"}`);

      console.log("\nSummary:");
      console.log(`  ${summary.summary}`);
      if (summary.details.length > 0) {
        console.log("  Details:");
        summary.details.forEach(detail => {
          console.log(`    - ${detail}`);
        });
      }

      // Exit code based on safety level
      if (assessment.level === SafetyLevel.DANGEROUS) {
        process.exit(1);
      } else if (assessment.level === SafetyLevel.REVIEW) {
        process.exit(2);
      }
    }
  } catch (err) {
    error(`Failed to analyze schema changes: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export async function ciValidateCommand(options: CIValidateOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    loadEnvFile(configPath);
    const config = readYamaConfig(configPath) as any;
    const resolvedConfig = resolveEnvVars(config) as any;

    if (!resolvedConfig.entities) {
      error("No entities found in yama.yaml");
      process.exit(1);
    }

    // Basic validation - check that entities can be converted to model
    try {
      entitiesToModel(resolvedConfig.entities);
      success("Schema validation passed");
    } catch (err) {
      error(`Schema validation failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } catch (err) {
    error(`Failed to validate configuration: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
