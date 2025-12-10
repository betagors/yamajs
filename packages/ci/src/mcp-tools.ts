import { z } from "zod";
import type { PluginMCPTool, MCPToolResult } from "@betagors/yama-core";
import type { CIPluginAPI } from "./plugin.js";

/**
 * Create MCP tools for CI plugin
 */
export function createCIMCPTools(api: CIPluginAPI, pluginName: string): PluginMCPTool[] {
  return [
    {
      name: "yama_ci_generate",
      description: "Generate GitHub Actions workflow files (test, build, deploy)",
      inputSchema: z.object({
        overwrite: z.boolean().optional().describe("Overwrite existing files"),
        testOnly: z.boolean().optional().describe("Generate test workflow only"),
        buildOnly: z.boolean().optional().describe("Generate build workflow only"),
        deployOnly: z.boolean().optional().describe("Generate deploy workflow only"),
      }),
      pluginName,
      handler: async (args: { overwrite?: boolean; testOnly?: boolean; buildOnly?: boolean; deployOnly?: boolean }): Promise<MCPToolResult> => {
        try {
          const workflows = api.generateAllWorkflows();
          let output = "✅ Workflow files generated successfully!\n\n";
          
          if (args.testOnly || (!args.buildOnly && !args.deployOnly)) {
            if (workflows.test) {
              output += `📄 .github/workflows/test.yml:\n\`\`\`yaml\n${workflows.test}\n\`\`\`\n\n`;
            }
          }
          
          if (args.buildOnly || (!args.testOnly && !args.deployOnly)) {
            if (workflows.build) {
              output += `📄 .github/workflows/build.yml:\n\`\`\`yaml\n${workflows.build}\n\`\`\`\n\n`;
            }
          }
          
          if (args.deployOnly || (!args.testOnly && !args.buildOnly)) {
            if (workflows.deploy) {
              output += `📄 .github/workflows/deploy.yml:\n\`\`\`yaml\n${workflows.deploy}\n\`\`\`\n\n`;
            }
          }
          
          output += "💡 Use 'yama ci write' to write these files to your project.";
          
          return {
            content: [
              {
                type: "text",
                text: output,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to generate workflow files: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
    {
      name: "yama_ci_write",
      description: "Write GitHub Actions workflow files to .github/workflows directory",
      inputSchema: z.object({
        overwrite: z.boolean().optional().describe("Overwrite existing files"),
        testOnly: z.boolean().optional().describe("Write test workflow only"),
        buildOnly: z.boolean().optional().describe("Write build workflow only"),
        deployOnly: z.boolean().optional().describe("Write deploy workflow only"),
      }),
      pluginName,
      handler: async (args: { overwrite?: boolean; testOnly?: boolean; buildOnly?: boolean; deployOnly?: boolean }): Promise<MCPToolResult> => {
        try {
          const overwrite = args.overwrite || false;
          const written: string[] = [];
          
          if (args.testOnly || (!args.buildOnly && !args.deployOnly)) {
            try {
              api.writeTestWorkflow(overwrite);
              written.push("test.yml");
            } catch (error) {
              if (error instanceof Error && error.message.includes("disabled")) {
                // Workflow disabled, skip
              } else {
                throw error;
              }
            }
          }
          
          if (args.buildOnly || (!args.testOnly && !args.deployOnly)) {
            try {
              api.writeBuildWorkflow(overwrite);
              written.push("build.yml");
            } catch (error) {
              if (error instanceof Error && error.message.includes("disabled")) {
                // Workflow disabled, skip
              } else {
                throw error;
              }
            }
          }
          
          if (args.deployOnly || (!args.testOnly && !args.buildOnly)) {
            try {
              api.writeDeployWorkflow(overwrite);
              written.push("deploy.yml");
            } catch (error) {
              if (error instanceof Error && error.message.includes("disabled")) {
                // Workflow disabled, skip
              } else {
                throw error;
              }
            }
          }
          
          return {
            content: [
              {
                type: "text",
                text: `✅ All workflow files written successfully!\n\n` +
                      `Written files:\n` +
                      written.map(f => `- .github/workflows/${f}`).join("\n"),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to write workflow files: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
  ];
}
