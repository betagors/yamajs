import { z } from "zod";
import { pluginSelectCommand } from "../../commands/plugin-select.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  category: z.string().optional().describe("Plugin category (e.g., 'database', 'email', 'storage', 'realtime', 'observability')"),
  feature: z.string().optional().describe("Specific feature or plugin name to search for (e.g., 'postgresql', 'smtp', 's3')"),
});

export const yamaPluginSelectTool = {
  name: "yama_plugin_select",
  description: "Helps decide which plugin to use for a specific need. Provides comparison of plugin options with pros, cons, and use cases. Use this tool when the user asks to: choose a plugin, compare plugins, which plugin for X, plugin options, or when they need help selecting between different plugin alternatives.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => pluginSelectCommand({ 
        config: args.config,
        category: args.category,
        feature: args.feature,
      }),
      { suppressExit: true }
    );

    if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to get plugin options\n\n${result.output}\n${result.error || ""}`,
          },
        ],
      };
    }

    try {
      const options = await pluginSelectCommand({
        config: args.config,
        category: args.category,
        feature: args.feature,
      });

      if (options.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `❌ No plugin options found for the specified criteria. Try a different category or feature.`,
            },
          ],
        };
      }

      // Format options
      const formatted = options
        .map((opt, idx) => {
          const configExample = opt.configExample
            ? `\n   Config Example:\n   \`\`\`yaml\n   ${JSON.stringify(opt.configExample, null, 2).split("\n").join("\n   ")}\n   \`\`\``
            : "";
          
          return `${idx + 1}. **${opt.name}** (${opt.category})\n   ${opt.description || ""}\n   \n   ✅ Pros:\n   ${opt.pros.map((p) => `   - ${p}`).join("\n   ")}\n   \n   ⚠️  Cons:\n   ${opt.cons.map((c) => `   - ${c}`).join("\n   ")}\n   \n   🎯 Best For:\n   ${opt.bestFor.map((b) => `   - ${b}`).join("\n   ")}${configExample}`;
        })
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `🔌 Plugin Options\n\n${formatted}\n\n💡 Use \`yama_add_plugin\` to add your chosen plugin.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to get plugin options\n\n${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};
