import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";

export async function getEndpointsResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const configPath = findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const config = readYamaConfig(configPath) as {
    endpoints?: Array<{
      path: string;
      method: string;
      handler: string;
      description?: string;
      params?: unknown;
      query?: unknown;
      body?: { type: string };
      response?: { type: string };
    }>;
  };

  const endpoints = config.endpoints || [];
  const endpointsJson = JSON.stringify(endpoints, null, 2);

  return {
    contents: [
      {
        uri: "yama://endpoints",
        mimeType: "application/json",
        text: endpointsJson,
      },
    ],
  };
}
