import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";
import { resolve } from "path";
import type { YamaSchemas } from "@betagors/yama-core";
import { getMCPWorkingDir } from "../utils/workdir.ts";

export async function getSchemasResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const workDir = getMCPWorkingDir();
  const originalCwd = process.cwd();
  
  try {
    if (workDir !== originalCwd) {
      process.chdir(workDir);
    }
    
    const configPath = findYamaConfig(workDir) || resolve(workDir, "yama.yaml");

    if (!existsSync(configPath)) {
      throw new Error(
        `Config file not found: ${configPath}\n` +
        `Working directory: ${workDir}\n` +
        `Tip: Set YAMA_MCP_WORKDIR environment variable to point to your YAMA project directory in a monorepo.`
      );
    }

  const config = readYamaConfig(configPath) as {
    schemas?: YamaSchemas;
  };

    const schemas = config.schemas || {};
    const schemasJson = JSON.stringify(schemas, null, 2);

    return {
      contents: [
        {
          uri: "yama://schemas",
          mimeType: "application/json",
          text: schemasJson,
        },
      ],
    };
  } finally {
    if (workDir !== originalCwd) {
      process.chdir(originalCwd);
    }
  }
}




