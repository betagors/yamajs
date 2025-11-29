import { z } from "zod";
import { endpointsCommand } from "../../commands/endpoints.ts";
import { executeCommand } from "../utils/output-capture.ts";
import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaEndpointsTool = {
  name: "yama_endpoints",
  description: "List all endpoints defined in yama.yaml",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const configPath = args.config || findYamaConfig() || "yama.yaml";

    if (!existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Config file not found: ${configPath}`,
          },
        ],
        isError: true,
      };
    }

    try {
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

      if (!config.endpoints || config.endpoints.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No endpoints defined",
            },
          ],
          isError: false,
        };
      }

      const endpointsJson = JSON.stringify(config.endpoints, null, 2);
      return {
        content: [
          {
            type: "text" as const,
            text: `📡 Endpoints (${config.endpoints.length}):\n\n${endpointsJson}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to read endpoints: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
