import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { YamaPlugin, PluginContext } from "@betagors/yama-core";
import type { CIPluginConfig } from "./types.js";
import {
  getCIProjectInfo,
  generateTestWorkflow,
  generateBuildWorkflow,
  generateDeployWorkflow,
  ensureWorkflowsDir,
} from "./generator.js";
import { createCICommands } from "./commands.js";
import { createCIMCPTools } from "./mcp-tools.js";

/**
 * CI plugin API
 */
export interface CIPluginAPI {
  /**
   * Generate test workflow
   */
  generateTestWorkflow(): string;

  /**
   * Generate build workflow
   */
  generateBuildWorkflow(): string;

  /**
   * Generate deploy workflow
   */
  generateDeployWorkflow(): string;

  /**
   * Generate all workflows
   */
  generateAllWorkflows(): {
    test: string;
    build: string;
    deploy: string;
  };

  /**
   * Write test workflow to .github/workflows/test.yml
   */
  writeTestWorkflow(overwrite?: boolean): void;

  /**
   * Write build workflow to .github/workflows/build.yml
   */
  writeBuildWorkflow(overwrite?: boolean): void;

  /**
   * Write deploy workflow to .github/workflows/deploy.yml
   */
  writeDeployWorkflow(overwrite?: boolean): void;

  /**
   * Write all workflow files
   */
  writeAll(overwrite?: boolean): void;

  /**
   * Get current configuration
   */
  getConfig(): CIPluginConfig;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CIPluginConfig>): void;

  /**
   * Get project information
   */
  getProjectInfo(): ReturnType<typeof getCIProjectInfo>;
}

/**
 * CI plugin implementation
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-ci",
  category: "deployment",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(
    opts: Record<string, unknown>,
    context: PluginContext
  ): Promise<CIPluginAPI> {
    const config: CIPluginConfig = {
      nodeVersions: ["20", "22"],
      enableTest: true,
      enableBuild: true,
      enableDeploy: false,
      deployTarget: "docker",
      ...(opts as Partial<CIPluginConfig>),
    };

    // Get project information
    const projectInfo = getCIProjectInfo(context.projectDir, config);

    // Ensure workflows directory exists
    ensureWorkflowsDir(context.projectDir);

    // Create and return API
    const api: CIPluginAPI = {
      generateTestWorkflow(): string {
        if (config.enableTest === false) {
          return "";
        }
        return generateTestWorkflow(projectInfo, config);
      },

      generateBuildWorkflow(): string {
        if (config.enableBuild === false) {
          return "";
        }
        return generateBuildWorkflow(projectInfo, config);
      },

      generateDeployWorkflow(): string {
        if (config.enableDeploy === false) {
          return "";
        }
        return generateDeployWorkflow(projectInfo, config);
      },

      generateAllWorkflows() {
        return {
          test: this.generateTestWorkflow(),
          build: this.generateBuildWorkflow(),
          deploy: this.generateDeployWorkflow(),
        };
      },

      writeTestWorkflow(overwrite = false): void {
        if (config.enableTest === false) {
          context.logger.info("Test workflow is disabled");
          return;
        }
        const workflowPath = join(context.projectDir, ".github", "workflows", "test.yml");
        if (!overwrite && existsSync(workflowPath)) {
          throw new Error(
            "test.yml already exists. Use overwrite=true to replace it."
          );
        }
        const content = generateTestWorkflow(projectInfo, config);
        writeFileSync(workflowPath, content, "utf-8");
        context.logger.info("Test workflow written successfully");
      },

      writeBuildWorkflow(overwrite = false): void {
        if (config.enableBuild === false) {
          context.logger.info("Build workflow is disabled");
          return;
        }
        const workflowPath = join(context.projectDir, ".github", "workflows", "build.yml");
        if (!overwrite && existsSync(workflowPath)) {
          throw new Error(
            "build.yml already exists. Use overwrite=true to replace it."
          );
        }
        const content = generateBuildWorkflow(projectInfo, config);
        writeFileSync(workflowPath, content, "utf-8");
        context.logger.info("Build workflow written successfully");
      },

      writeDeployWorkflow(overwrite = false): void {
        if (config.enableDeploy === false) {
          context.logger.info("Deploy workflow is disabled");
          return;
        }
        const workflowPath = join(context.projectDir, ".github", "workflows", "deploy.yml");
        if (!overwrite && existsSync(workflowPath)) {
          throw new Error(
            "deploy.yml already exists. Use overwrite=true to replace it."
          );
        }
        const content = generateDeployWorkflow(projectInfo, config);
        writeFileSync(workflowPath, content, "utf-8");
        context.logger.info("Deploy workflow written successfully");
      },

      writeAll(overwrite = false): void {
        this.writeTestWorkflow(overwrite);
        this.writeBuildWorkflow(overwrite);
        this.writeDeployWorkflow(overwrite);
        context.logger.info("All workflow files written successfully");
      },

      getConfig(): CIPluginConfig {
        return { ...config };
      },

      updateConfig(newConfig: Partial<CIPluginConfig>): void {
        Object.assign(config, newConfig);
        // Update project info if needed
        Object.assign(projectInfo, getCIProjectInfo(context.projectDir, config));
        context.logger.debug("CI plugin configuration updated");
      },

      getProjectInfo() {
        return projectInfo;
      },
    };

    // Register as ci service
    context.registerService("ci", api);
    context.logger.info("CI service registered");

    // Register CLI commands
    const commands = createCICommands(api, plugin.name);
    for (const command of commands) {
      context.registerCLICommand(command);
    }
    context.logger.info(`Registered ${commands.length} CLI command(s) for CI plugin`);

    // Register MCP tools
    const tools = createCIMCPTools(api, plugin.name);
    for (const tool of tools) {
      context.registerMCPTool(tool);
    }
    context.logger.info(`Registered ${tools.length} MCP tool(s) for CI plugin`);

    return api;
  },
};

export default plugin;
