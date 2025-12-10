import { z } from "zod";
import { addPluginCommand } from "../../commands/add-plugin.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  name: z.string().describe("Plugin package name (e.g., @betagors/yama-postgres)"),
  configOnly: z.boolean().optional().describe("Only add to yama.yaml, don't install the package"),
});

export const yamaAddPluginTool = {
  name: "yama_add_plugin",
  description: "Adds a plugin to the yama.yaml configuration and optionally installs the npm package. Use this tool when the user asks to add a plugin, install a plugin, enable a plugin, add plugin support, or when they want to extend YAMA functionality with a plugin like database adapters, authentication, or other features.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => addPluginCommand({ 
        config: args.config,
        name: args.name,
        configOnly: args.configOnly,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Plugin added successfully\n\n${result.output}`
            : `❌ Failed to add plugin\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
