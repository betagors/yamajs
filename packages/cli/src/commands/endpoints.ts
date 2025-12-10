import { existsSync } from "fs";
import { readYamaConfig } from "../utils/file-utils.ts";
import { findYamaConfig } from "../utils/project-detection.ts";

interface EndpointsOptions {
  config?: string;
}

export async function endpointsCommand(options: EndpointsOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as {
      endpoints?: Array<{
        path: string;
        method: string;
        handler: string;
        description?: string;
        params?: Record<string, unknown>;
        query?: Record<string, unknown>;
        body?: { type: string };
        response?: { type: string };
      }>;
    };

    if (!config.endpoints || config.endpoints.length === 0) {
      console.log("No endpoints defined");
      return;
    }

    console.log(`📡 Endpoints (${config.endpoints.length}):\n`);

    config.endpoints.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.method.toUpperCase()} ${endpoint.path}`);
      console.log(`   Handler: ${endpoint.handler}`);
      
      if (endpoint.description) {
        console.log(`   Description: ${endpoint.description}`);
      }
      
      if (endpoint.params) {
        console.log(`   Path params: ${Object.keys(endpoint.params).join(", ")}`);
      }
      
      if (endpoint.query) {
        console.log(`   Query params: ${Object.keys(endpoint.query).join(", ")}`);
      }
      
      if (endpoint.body) {
        console.log(`   Body: ${endpoint.body.type}`);
      }
      
      if (endpoint.response) {
        console.log(`   Response: ${endpoint.response.type}`);
      }
      
      console.log();
    });
  } catch (error) {
    console.error("❌ Failed to read endpoints:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

