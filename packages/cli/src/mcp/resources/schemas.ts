import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";
import type { YamaSchemas } from "@betagors/yama-core";

export async function getSchemasResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const configPath = findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
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
}
