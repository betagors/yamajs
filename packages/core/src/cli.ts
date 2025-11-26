#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import yaml from "js-yaml";
import { generateTypes } from "./typegen.js";
import type { YamaSchemas } from "./schemas.js";

const args = process.argv.slice(2);
const yamlPath = args[0] || "yama.yaml";
const outputPath = args[1] || "src/types";

try {
  const yamlContent = readFileSync(yamlPath, "utf-8");
  const config = yaml.load(yamlContent) as { schemas?: YamaSchemas };
  
  if (!config.schemas) {
    console.error("❌ No schemas found in YAML config");
    process.exit(1);
  }
  
  const types = generateTypes(config.schemas);
  const configDir = dirname(yamlPath);
  const outputFile = join(configDir, outputPath);
  
  writeFileSync(outputFile, types, "utf-8");
  console.log(`✅ Generated types: ${outputFile}`);
} catch (error) {
  console.error("❌ Failed to generate types:", error);
  process.exit(1);
}

