import { existsSync } from "fs";
import { readYamaConfig } from "../utils/file-utils.js";
import { findYamaConfig } from "../utils/project-detection.js";
import type { YamaSchemas } from "@yama/core";

interface SchemasOptions {
  config?: string;
}

export async function schemasCommand(options: SchemasOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as {
      schemas?: YamaSchemas;
    };

    if (!config.schemas || Object.keys(config.schemas).length === 0) {
      console.log("No schemas defined");
      return;
    }

    console.log(`📦 Schemas (${Object.keys(config.schemas).length}):\n`);

    for (const [schemaName, schemaDef] of Object.entries(config.schemas)) {
      console.log(`${schemaName}:`);
      
      if (schemaDef.fields) {
        for (const [fieldName, field] of Object.entries(schemaDef.fields)) {
          const required = field.required ? "required" : "optional";
          const type = field.$ref || field.type || "unknown";
          const defaultVal = field.default !== undefined ? ` (default: ${JSON.stringify(field.default)})` : "";
          
          console.log(`  - ${fieldName}: ${type} [${required}]${defaultVal}`);
        }
      }
      
      console.log();
    }
  } catch (error) {
    console.error("❌ Failed to read schemas:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}


