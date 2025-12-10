import { z } from "zod";
import { configCommand } from "../../commands/config.ts";
import { executeCommand } from "../utils/output-capture.ts";
import { readYamaConfig } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaConfigTool = {
  name: "yama_config",
  description: "Reads and displays the yama.yaml configuration file. ALWAYS use this tool when the user asks to: see the configuration, view config, read yama.yaml, show settings, display config, get config, show yama config, view yama.yaml, or when you need to understand the current YAMA project configuration including plugins, endpoints, schemas, and other settings.",
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
      const config = readYamaConfig(configPath);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(config, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to read config: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};










