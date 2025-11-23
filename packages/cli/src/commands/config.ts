import { existsSync } from "fs";
import { readYamaConfig } from "../utils/file-utils.ts";
import { findYamaConfig } from "../utils/project-detection.ts";

interface ConfigOptions {
  config?: string;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath);
    
    console.log(`📋 Configuration (${configPath}):\n`);
    console.log(JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("❌ Failed to read config:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

