import { z } from "zod";
import { pluginRecommendCommand } from "../../commands/plugin-recommend.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  feature: z.string().optional().describe("Optional: specific feature to check for (e.g., 'database', 'email', 'storage')"),
});

export const yamaPluginRecommendTool = {
  name: "yama_plugin_recommend",
  description: "Analyzes the YAMA project configuration and recommends plugins that might be needed based on entities, endpoints, and other features. Use this tool when the user asks to: recommend plugins, suggest plugins, what plugins do I need, which plugins should I use, analyze plugin needs, or when you need to determine what plugins are missing from a project.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => pluginRecommendCommand({ 
        config: args.config,
        feature: args.feature,
      }),
      { suppressExit: true }
    );

    if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to get plugin recommendations\n\n${result.output}\n${result.error || ""}`,
          },
        ],
      };
    }

    // Parse the recommendations from the command output
    // Since the command returns an array, we need to format it nicely
    try {
      const recommendations = await pluginRecommendCommand({
        config: args.config,
        feature: args.feature,
      });

      if (recommendations.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "✅ No additional plugins recommended. Your project appears to have all necessary plugins configured.",
            },
          ],
        };
      }

      // Format recommendations
      const formatted = recommendations
        .map((rec, idx) => {
          const priorityEmoji = rec.priority === "high" ? "🔴" : rec.priority === "medium" ? "🟡" : "🟢";
          return `${idx + 1}. ${priorityEmoji} **${rec.plugin}** (${rec.category})\n   Priority: ${rec.priority}\n   Reason: ${rec.reason}\n   ${rec.description ? `Description: ${rec.description}` : ""}`;
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `📦 Plugin Recommendations\n\n${formatted}\n\n💡 Use \`yama_add_plugin\` to add recommended plugins.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to get plugin recommendations\n\n${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};
