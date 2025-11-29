import { existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { success, error, info } from "../utils/cli-utils.ts";
import { promptMigrationName } from "../utils/interactive.ts";

interface MigrationCreateOptions {
  name?: string;
  config?: string;
  type?: "schema" | "data" | "custom";
  template?: "empty" | "table" | "column" | "index";
}

/**
 * Get next migration number
 */
function getNextMigrationNumber(migrationsDir: string): number {
  if (!existsSync(migrationsDir)) {
    return 1;
  }

  try {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => {
        const match = f.match(/^(\d+)_/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    if (files.length === 0) {
      return 1;
    }

    return Math.max(...files) + 1;
  } catch {
    return 1;
  }
}

/**
 * Generate migration template
 */
function generateMigrationTemplate(
  name: string,
  type: "schema" | "data" | "custom",
  template: "empty" | "table" | "column" | "index"
): string {
  const timestamp = new Date().toISOString();
  
  let content = `-- Migration: ${name}
-- Created: ${timestamp}
-- Type: ${type}

`;

  if (template === "empty") {
    content += `-- Up
-- TODO: Add your migration SQL here

-- Down
-- TODO: Add your rollback SQL here
`;
  } else if (template === "table") {
    content += `-- Up
CREATE TABLE IF NOT EXISTS example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down
DROP TABLE IF EXISTS example_table;
`;
  } else if (template === "column") {
    content += `-- Up
ALTER TABLE example_table
ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);

-- Down
ALTER TABLE example_table
DROP COLUMN IF EXISTS new_column;
`;
  } else if (template === "index") {
    content += `-- Up
CREATE INDEX IF NOT EXISTS idx_example_table_column
ON example_table(column_name);

-- Down
DROP INDEX IF EXISTS idx_example_table_column;
`;
  }

  return content;
}

export async function migrationCreateCommand(
  options: MigrationCreateOptions
): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    console.log("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const migrationsDir = join(configDir, "migrations");

    // Ensure migrations directory exists
    if (!existsSync(migrationsDir)) {
      mkdirSync(migrationsDir, { recursive: true });
      info(`Created migrations directory: ${migrationsDir}`);
    }

    // Get migration name
    let migrationName = options.name;
    if (!migrationName) {
      migrationName = await promptMigrationName();
    }

    // Validate migration name
    if (!/^[a-z0-9_-]+$/i.test(migrationName)) {
      error("Migration name can only contain letters, numbers, underscores, and hyphens");
      process.exit(1);
    }

    // Get next migration number
    const migrationNumber = getNextMigrationNumber(migrationsDir);
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "");
    const fileName = `${String(migrationNumber).padStart(4, "0")}_${migrationName}.sql`;
    const filePath = join(migrationsDir, fileName);

    // Check if file already exists
    if (existsSync(filePath)) {
      error(`Migration file already exists: ${fileName}`);
      process.exit(1);
    }

    // Generate migration template
    const type = options.type || "schema";
    const template = options.template || "empty";
    const content = generateMigrationTemplate(migrationName, type, template);

    // Write migration file
    writeFileSync(filePath, content, "utf-8");

    success(`Created migration: ${fileName}`);
    info(`   Location: ${filePath}`);
    info(`   Type: ${type}`);
    info(`   Template: ${template}`);
    info("\n   Next steps:");
    info("   1. Edit the migration file to add your SQL");
    info("   2. Review the migration carefully");
    info("   3. Test locally: yama schema:apply --env development");
    info("   4. Apply to production: yama schema:apply --env production");
  } catch (err) {
    error(`Failed to create migration: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}









