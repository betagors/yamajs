import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { schemaCheckCommand } from "./schema-check.ts";
import { schemaGenerateCommand } from "./schema-generate.ts";
import { success, error, info } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";

interface SchemaFixOptions {
  config?: string;
  action?: string;
}

export async function schemaFixCommand(options: SchemaFixOptions): Promise<void> {
  const action = options.action || "drift";

  if (action === "drift") {
    info("Checking for schema drift...");
    
    try {
      // Run migration:check to detect drift
      await schemaCheckCommand({ config: options.config, diff: true });
      
      // If we get here, there's drift
      const shouldFix = await confirm("Generate migration to fix drift?", false);
      if (shouldFix) {
        await schemaGenerateCommand({
          config: options.config,
          interactive: true,
        });
      }
    } catch (err) {
      // migration:check exits with code 1 if drift detected, which is expected
      const shouldFix = await confirm("Generate migration to fix drift?", false);
      if (shouldFix) {
        await schemaGenerateCommand({
          config: options.config,
          interactive: true,
        });
      }
    }
  } else if (action === "validate-migrations") {
    const configPath = options.config || findYamaConfig() || "yama.yaml";
    const configDir = getConfigDir(configPath);
    const migrationsDir = join(configDir, "migrations");

    if (!existsSync(migrationsDir)) {
      info("No migrations directory found.");
      return;
    }

    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".yaml"))
      .sort();

    let validCount = 0;
    let invalidCount = 0;

    for (const file of migrationFiles) {
      try {
        const content = readFileSync(join(migrationsDir, file), "utf-8");
        JSON.parse(content); // Basic validation
        validCount++;
      } catch (err) {
        error(`Invalid migration: ${file}`);
        invalidCount++;
      }
    }

    if (invalidCount === 0) {
      success(`All ${validCount} migrations are valid`);
    } else {
      error(`${invalidCount} migration(s) have errors`);
      process.exit(1);
    }
  } else {
    error(`Unknown fix action: ${action}`);
    error("Available actions: drift, validate-migrations");
    process.exit(1);
  }
}

