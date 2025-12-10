import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";
import { resolve } from "path";
import { getMCPWorkingDir } from "../utils/workdir.ts";

export async function getConfigResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const workDir = getMCPWorkingDir();
  const originalCwd = process.cwd();
  
  try {
    // Temporarily change working directory for config lookup
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

    const config = readYamaConfig(configPath);
    const configJson = JSON.stringify(config, null, 2);

    return {
      contents: [
        {
          uri: "yama://config",
          mimeType: "application/json",
          text: configJson,
        },
      ],
    };
  } finally {
    // Restore original working directory
    if (workDir !== originalCwd) {
      process.chdir(originalCwd);
    }
  }
}




