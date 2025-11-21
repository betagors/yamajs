import { existsSync } from "fs";
import { join } from "path";
import { generateMigrationFile } from "@yama/db-postgres";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.js";
import { findYamaConfig } from "../utils/project-detection.js";
import type { YamaEntities } from "@yama/core";

interface MigrateOptions {
  config?: string;
  name?: string;
}

export async function migrateCommand(options: MigrateOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    console.error("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as { entities?: YamaEntities };
    const configDir = getConfigDir(configPath);

    if (!config.entities || Object.keys(config.entities).length === 0) {
      console.log("ℹ️  No entities defined in yama.yaml");
      return;
    }

    const migrationsDir = join(configDir, "migrations");
    const migrationName = options.name || "migration";

    const filePath = generateMigrationFile(config.entities, migrationsDir, migrationName);
    const relativePath = filePath.replace(configDir + "/", "");

    console.log(`✅ Generated migration: ${relativePath}`);
    console.log(`\n📝 Review the migration file before applying it.`);
    console.log(`   Apply with: yama db:migrate:apply`);
  } catch (error) {
    console.error("❌ Failed to generate migration:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}


