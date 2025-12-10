import { z } from "zod";
import type { PluginMCPTool, MCPToolResult } from "@betagors/yama-core";
import type { DockerPluginAPI } from "./plugin.js";

/**
 * Create MCP tools for Docker plugin
 */
export function createDockerMCPTools(api: DockerPluginAPI, pluginName: string): PluginMCPTool[] {
  return [
    {
      name: "yama_docker_generate",
      description: "Generate Dockerfile, docker-compose.yml, and .dockerignore files",
      inputSchema: z.object({
        overwrite: z.boolean().optional().describe("Overwrite existing files"),
      }),
      pluginName,
      handler: async (args: { overwrite?: boolean }): Promise<MCPToolResult> => {
        try {
          const overwrite = args.overwrite || false;
          const dockerfile = api.generateDockerfile();
          const compose = api.generateDockerCompose();
          const dockerignore = api.generateDockerIgnore();
          
          return {
            content: [
              {
                type: "text",
                text: `✅ Docker files generated successfully!\n\n` +
                      `📄 Dockerfile:\n\`\`\`dockerfile\n${dockerfile}\n\`\`\`\n\n` +
                      `📄 docker-compose.yml:\n\`\`\`yaml\n${compose}\n\`\`\`\n\n` +
                      `📄 .dockerignore:\n\`\`\`\n${dockerignore}\n\`\`\`\n\n` +
                      `💡 Use 'yama docker write' to write these files to your project.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to generate Docker files: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
    {
      name: "yama_docker_write",
      description: "Write Docker files (Dockerfile, docker-compose.yml, .dockerignore) to project directory",
      inputSchema: z.object({
        overwrite: z.boolean().optional().describe("Overwrite existing files"),
      }),
      pluginName,
      handler: async (args: { overwrite?: boolean }): Promise<MCPToolResult> => {
        try {
          const overwrite = args.overwrite || false;
          api.writeAll(overwrite);
          
          return {
            content: [
              {
                type: "text",
                text: `✅ All Docker files written successfully!\n\n` +
                      `- Dockerfile\n` +
                      `- docker-compose.yml\n` +
                      `- .dockerignore`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to write Docker files: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
  ];
}
