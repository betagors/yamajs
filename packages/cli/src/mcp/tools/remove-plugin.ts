import { z } from "zod";
import { removePluginCommand } from "../../commands/remove-plugin.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  name: z.string().describe("Plugin package name to remove"),
  keepPackage: z.boolean().optional().describe("Keep the npm package, only remove from yama.yaml"),
});

export const yamaRemovePluginTool = {
  name: "yama_remove_plugin",
  description: "Removes a plugin from the yama.yaml configuration and optionally uninstalls the npm package. Use this tool when the user asks to remove a plugin, uninstall a plugin, disable a plugin, or when they want to remove plugin functionality from their YAMA project.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => removePluginCommand({ 
        config: args.config,
        name: args.name,
        keepPackage: args.keepPackage,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Plugin removed successfully\n\n${result.output}`
            : `❌ Failed to remove plugin\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
