import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { YamaPlugin, PluginContext } from "@betagors/yama-core";
import type { DockerPluginConfig } from "./types.js";
import {
  getProjectInfo,
  generateDockerfile,
  generateDockerCompose,
  generateDockerIgnore,
} from "./generator.js";
import { createDockerCommands } from "./commands.js";
import { createDockerMCPTools } from "./mcp-tools.js";

/**
 * Docker plugin API
 */
export interface DockerPluginAPI {
  /**
   * Generate Dockerfile
   */
  generateDockerfile(): string;

  /**
   * Generate docker-compose.yml
   */
  generateDockerCompose(): string;

  /**
   * Generate .dockerignore
   */
  generateDockerIgnore(): string;

  /**
   * Write Dockerfile to project directory
   */
  writeDockerfile(overwrite?: boolean): void;

  /**
   * Write docker-compose.yml to project directory
   */
  writeDockerCompose(overwrite?: boolean): void;

  /**
   * Write .dockerignore to project directory
   */
  writeDockerIgnore(overwrite?: boolean): void;

  /**
   * Write all Docker files
   */
  writeAll(overwrite?: boolean): void;

  /**
   * Get current configuration
   */
  getConfig(): DockerPluginConfig;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DockerPluginConfig>): void;

  /**
   * Get project information
   */
  getProjectInfo(): ReturnType<typeof getProjectInfo>;
}

/**
 * Docker plugin implementation
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-docker",
  category: "deployment",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(
    opts: Record<string, unknown>,
    context: PluginContext
  ): Promise<DockerPluginAPI> {
    const config: DockerPluginConfig = {
      nodeVersion: "20",
      baseImage: "alpine",
      port: 4000,
      healthCheck: true,
      healthCheckPath: "/health",
      nonRootUser: true,
      outputDir: "dist",
      ...(opts as Partial<DockerPluginConfig>),
    };

    // Get project information
    const projectInfo = getProjectInfo(context.projectDir, config);

    // Create and return API
    const api: DockerPluginAPI = {
      generateDockerfile(): string {
        return generateDockerfile(projectInfo, config);
      },

      generateDockerCompose(): string {
        return generateDockerCompose(projectInfo, config);
      },

      generateDockerIgnore(): string {
        return generateDockerIgnore(projectInfo);
      },

      writeDockerfile(overwrite = false): void {
        const dockerfilePath = join(context.projectDir, "Dockerfile");
        if (!overwrite && existsSync(dockerfilePath)) {
          throw new Error(
            "Dockerfile already exists. Use overwrite=true to replace it."
          );
        }
        const content = generateDockerfile(projectInfo, config);
        writeFileSync(dockerfilePath, content, "utf-8");
        context.logger.info("Dockerfile written successfully");
      },

      writeDockerCompose(overwrite = false): void {
        const composePath = join(context.projectDir, "docker-compose.yml");
        if (!overwrite && existsSync(composePath)) {
          throw new Error(
            "docker-compose.yml already exists. Use overwrite=true to replace it."
          );
        }
        const content = generateDockerCompose(projectInfo, config);
        writeFileSync(composePath, content, "utf-8");
        context.logger.info("docker-compose.yml written successfully");
      },

      writeDockerIgnore(overwrite = false): void {
        const dockerignorePath = join(context.projectDir, ".dockerignore");
        if (!overwrite && existsSync(dockerignorePath)) {
          throw new Error(
            ".dockerignore already exists. Use overwrite=true to replace it."
          );
        }
        const content = generateDockerIgnore(projectInfo);
        writeFileSync(dockerignorePath, content, "utf-8");
        context.logger.info(".dockerignore written successfully");
      },

      writeAll(overwrite = false): void {
        this.writeDockerfile(overwrite);
        this.writeDockerCompose(overwrite);
        this.writeDockerIgnore(overwrite);
        context.logger.info("All Docker files written successfully");
      },

      getConfig(): DockerPluginConfig {
        return { ...config };
      },

      updateConfig(newConfig: Partial<DockerPluginConfig>): void {
        Object.assign(config, newConfig);
        // Update project info if needed
        Object.assign(projectInfo, getProjectInfo(context.projectDir, config));
        context.logger.debug("Docker plugin configuration updated");
      },

      getProjectInfo() {
        return projectInfo;
      },
    };

    // Register as docker service
    context.registerService("docker", api);
    context.logger.info("Docker service registered");

    // Register CLI commands
    const commands = createDockerCommands(api, plugin.name);
    for (const command of commands) {
      context.registerCLICommand(command);
    }
    context.logger.info(`Registered ${commands.length} CLI command(s) for Docker plugin`);

    // Register MCP tools
    const tools = createDockerMCPTools(api, plugin.name);
    for (const tool of tools) {
      context.registerMCPTool(tool);
    }
    context.logger.info(`Registered ${tools.length} MCP tool(s) for Docker plugin`);

    return api;
  },
};

export default plugin;




