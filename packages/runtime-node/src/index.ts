import Fastify from "fastify";
import { helloYamaCore } from "@yama/core";
import yaml from "js-yaml";
import { readFileSync } from "fs";
import { join } from "path";

interface YamaConfig {
  name?: string;
  version?: string;
  models?: Record<string, unknown>;
  endpoints?: Array<{
    path: string;
    method: string;
    handler: string;
    description?: string;
    body?: unknown;
  }>;
}

export async function startYamaNodeRuntime(
  port = 3000,
  yamlConfigPath?: string
) {
  const app = Fastify();

  // Load and parse YAML config if provided
  let config: YamaConfig | null = null;
  if (yamlConfigPath) {
    try {
      const configFile = readFileSync(yamlConfigPath, "utf-8");
      config = yaml.load(configFile) as YamaConfig;
      console.log("✅ Loaded YAML config:", JSON.stringify(config, null, 2));
    } catch (error) {
      console.error("❌ Failed to load YAML config:", error);
    }
  }

  app.get("/health", async () => ({
    status: "ok",
    core: helloYamaCore(),
    configLoaded: config !== null
  }));

  // Expose config for inspection
  app.get("/config", async () => ({
    config
  }));

  // TODO: Generate routes from config
  if (config?.endpoints) {
    console.log("📋 Found endpoints in config:", config.endpoints);
    // Future: dynamically register routes from config
  }

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Yama runtime listening on http://localhost:${port}`);
}

