import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";

export async function getConfigResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const configPath = findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
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
}
