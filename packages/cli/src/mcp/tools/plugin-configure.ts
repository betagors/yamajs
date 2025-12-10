import { z } from "zod";
import { pluginConfigureCommand, applyPluginConfig } from "../../commands/plugin-configure.ts";
import { executeCommand } from "../utils/output-capture.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { existsSync } from "fs";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  plugin: z.string().describe("Plugin package name to configure (e.g., @betagors/yama-postgres)"),
  settings: z.record(z.unknown()).optional().describe("Optional: specific settings to configure as key-value pairs"),
  apply: z.boolean().optional().describe("Whether to apply the configuration to yama.yaml (default: false)"),
});

export const yamaPluginConfigureTool = {
  name: "yama_plugin_configure",
  description: "Helps configure a plugin by showing current configuration, required fields, optional fields, and recommended settings. Can also apply configuration to yama.yaml. Use this tool when the user asks to: configure a plugin, plugin settings, plugin config, setup plugin, or when they need help configuring plugin options.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const configPath = args.config || findYamaConfig() || "yama.yaml";

    if (!existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Config file not found: ${configPath}\n\nRun 'yama init' to create a yama.yaml file.`,
          },
        ],
      };
    }

    try {
      const configInfo = await pluginConfigureCommand({
        config: configPath,
        plugin: args.plugin,
        settings: args.settings,
      });

      // Format configuration info
      const currentConfigStr = Object.keys(configInfo.currentConfig).length > 0
        ? `\`\`\`yaml\n${JSON.stringify(configInfo.currentConfig, null, 2)}\n\`\`\``
        : "No configuration set";

      const recommendedConfigStr = Object.keys(configInfo.recommendedConfig).length > 0
        ? `\`\`\`yaml\n${JSON.stringify(configInfo.recommendedConfig, null, 2)}\n\`\`\``
        : "No recommended configuration";

      const requiredFieldsStr = configInfo.requiredFields.length > 0
        ? configInfo.requiredFields.map((f) => `   - ${f}`).join("\n")
        : "   (none)";

      const optionalFieldsStr = configInfo.optionalFields.length > 0
        ? configInfo.optionalFields.map((f) => `   - ${f}`).join("\n")
        : "   (none)";

      const examplesStr = configInfo.examples.length > 0
        ? configInfo.examples
            .map((ex, idx) => `Example ${idx + 1}:\n\`\`\`yaml\n${JSON.stringify(ex, null, 2)}\n\`\`\``)
            .join("\n\n")
        : "No examples available";

      let responseText = `⚙️  Plugin Configuration: **${configInfo.plugin}**\n\n`;
      responseText += `📋 Current Configuration:\n${currentConfigStr}\n\n`;
      responseText += `✨ Recommended Configuration:\n${recommendedConfigStr}\n\n`;
      responseText += `🔴 Required Fields:\n${requiredFieldsStr}\n\n`;
      responseText += `⚪ Optional Fields:\n${optionalFieldsStr}\n\n`;
      responseText += `📚 Configuration Examples:\n${examplesStr}\n`;

      // Apply configuration if requested
      if (args.apply) {
        try {
          await applyPluginConfig(configPath, args.plugin, configInfo.recommendedConfig);
          responseText += `\n✅ Configuration applied to yama.yaml`;
        } catch (error) {
          responseText += `\n❌ Failed to apply configuration: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        responseText += `\n💡 Set \`apply: true\` to automatically apply this configuration to yama.yaml.`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to get plugin configuration\n\n${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};
