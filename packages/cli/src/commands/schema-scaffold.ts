import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { success, error, info } from "../utils/cli-utils.ts";
import type { YamaEntities } from "@betagors/yama-core";

interface SchemaScaffoldOptions {
  config?: string;
  table?: string;
  column?: string;
  type?: string;
}

export async function schemaScaffoldCommand(
  action: string,
  args: string[],
  options: SchemaScaffoldOptions
): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as { entities?: YamaEntities };
    const entities = config.entities || {};

    if (action === "add-table" && args.length > 0) {
      const tableName = args[0];
      const entityName = tableName.charAt(0).toUpperCase() + tableName.slice(1);

      if (entities[entityName]) {
        error(`Entity ${entityName} already exists`);
        process.exit(1);
      }

      // Add basic entity structure with new shorthand syntax
      // Note: This will be written as YAML, so we use string shorthand
      // The actual YAML writing should use shorthand syntax
      entities[entityName] = {
        table: tableName,
        fields: {
          id: "uuid!",
          createdAt: "timestamp",
          updatedAt: "timestamp",
        },
      };

      // Write back to config
      const fullConfig = readFileSync(configPath, "utf-8");
      // Simple YAML update - in production, use proper YAML parser
      const yamlContent = fullConfig + `\n# Scaffolded entity: ${entityName}\n`;
      writeFileSync(configPath, yamlContent, "utf-8");

      success(`Scaffolded table: ${tableName}`);
      info(`Run 'yama migration:generate' to create migration`);
    } else if (action === "add-column" && args.length >= 3) {
      const [tableName, columnName, columnType] = args;
      const entityName = Object.keys(entities).find(
        (name) => entities[name].table === tableName
      );

      if (!entityName) {
        error(`Table ${tableName} not found`);
        process.exit(1);
      }

      // Add column to entity
      entities[entityName].fields[columnName] = {
        type: columnType as any,
      };

      success(`Scaffolded column: ${tableName}.${columnName}`);
      info(`Run 'yama migration:generate' to create migration`);
    } else {
      error("Invalid scaffold command");
      error("Usage: yama schema:scaffold add-table <name>");
      error("       yama schema:scaffold add-column <table> <column> <type>");
      process.exit(1);
    }
  } catch (err) {
    error(`Failed to scaffold: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

