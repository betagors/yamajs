import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";
import { resolve } from "path";
import { getMCPWorkingDir } from "../utils/workdir.ts";
import { normalizeApisConfig } from "@betagors/yama-core";

export async function getEndpointsResource(uri: string): Promise<{
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
      apis?: {
        rest?: any;
      };
    };

    if (!config.apis?.rest) {
      return {
        contents: [{
          uri: "yama://endpoints",
          mimeType: "application/json",
          text: "[]",
        }],
      };
    }

    const normalizedApis = normalizeApisConfig({ apis: config.apis });
    const allEndpoints = normalizedApis.rest.flatMap(restConfig => 
      restConfig.endpoints.map(e => ({
        ...e,
        basePath: restConfig.basePath,
        configName: restConfig.name,
      }))
    );

    const endpointsJson = JSON.stringify(allEndpoints, null, 2);

    return {
      contents: [
        {
          uri: "yama://endpoints",
          mimeType: "application/json",
          text: endpointsJson,
        },
      ],
    };
  } finally {
    if (workDir !== originalCwd) {
      process.chdir(originalCwd);
    }
  }
}




