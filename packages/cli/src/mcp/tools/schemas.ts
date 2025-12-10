import { z } from "zod";
import { schemasCommand } from "../../commands/schemas.ts";
import { executeCommand } from "../utils/output-capture.ts";
import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";
import type { YamaSchemas } from "@betagors/yama-core";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaSchemasTool = {
  name: "yama_schemas",
  description: "Lists all data schemas defined in the yama.yaml configuration file. Use this tool when the user asks to see schemas, list schemas, view data models, show data structures, or when you need to understand the data models and types defined in the YAMA project. This displays all schema definitions with their fields, types, and validation rules.",
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
      };
    }

    try {
      const config = readYamaConfig(configPath) as {
        schemas?: YamaSchemas;
      };

      if (!config.schemas || Object.keys(config.schemas).length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No schemas defined",
            },
          ],
        };
      }

      const schemasJson = JSON.stringify(config.schemas, null, 2);
      return {
        content: [
          {
            type: "text" as const,
            text: `📦 Schemas (${Object.keys(config.schemas).length}):\n\n${schemasJson}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to read schemas: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};










