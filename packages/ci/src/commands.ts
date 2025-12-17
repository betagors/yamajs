import type { PluginCLICommand } from "@yamajs/core";
import type { CIPluginAPI } from "./plugin.js";

/**
 * Create CLI commands for CI plugin
 */
export function createCICommands(api: CIPluginAPI, pluginName: string): PluginCLICommand[] {
  return [
    {
      name: "ci generate",
      description: "Generate GitHub Actions workflow files",
      options: [
        {
          flags: "--overwrite",
          description: "Overwrite existing files",
          defaultValue: false,
        },
        {
          flags: "--test-only",
          description: "Generate test workflow only",
          defaultValue: false,
        },
        {
          flags: "--build-only",
          description: "Generate build workflow only",
          defaultValue: false,
        },
        {
          flags: "--deploy-only",
          description: "Generate deploy workflow only",
          defaultValue: false,
        },
      ],
      pluginName,
      action: async (options: { overwrite?: boolean; testOnly?: boolean; buildOnly?: boolean; deployOnly?: boolean }) => {
        const overwrite = options.overwrite || false;
        try {
          console.log("ðŸš€ Generating CI/CD workflow files...\n");
          
          const workflows = api.generateAllWorkflows();
          
          if (options.testOnly || (!options.buildOnly && !options.deployOnly)) {
            if (workflows.test) {
              console.log("ðŸ“„ .github/workflows/test.yml:");
              console.log(workflows.test);
            }
          }
          
          if (options.buildOnly || (!options.testOnly && !options.deployOnly)) {
            if (workflows.build) {
              console.log("\nðŸ“„ .github/workflows/build.yml:");
              console.log(workflows.build);
            }
          }
          
          if (options.deployOnly || (!options.testOnly && !options.buildOnly)) {
            if (workflows.deploy) {
              console.log("\nðŸ“„ .github/workflows/deploy.yml:");
              console.log(workflows.deploy);
            }
          }
          
          console.log("\nâœ… Workflow files generated successfully!");
          console.log("ðŸ’¡ Use 'yama ci write' to write these files to your project.");
        } catch (error) {
          console.error("âŒ Failed to generate workflow files:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
    },
    {
      name: "ci write",
      description: "Write GitHub Actions workflow files to .github/workflows",
      options: [
        {
          flags: "--overwrite",
          description: "Overwrite existing files",
          defaultValue: false,
        },
        {
          flags: "--test-only",
          description: "Write test workflow only",
          defaultValue: false,
        },
        {
          flags: "--build-only",
          description: "Write build workflow only",
          defaultValue: false,
        },
        {
          flags: "--deploy-only",
          description: "Write deploy workflow only",
          defaultValue: false,
        },
      ],
      pluginName,
      action: async (options: { overwrite?: boolean; testOnly?: boolean; buildOnly?: boolean; deployOnly?: boolean }) => {
        const overwrite = options.overwrite || false;
        try {
          console.log("ðŸš€ Writing CI/CD workflow files...\n");
          
          if (options.testOnly || (!options.buildOnly && !options.deployOnly)) {
            api.writeTestWorkflow(overwrite);
          }
          
          if (options.buildOnly || (!options.testOnly && !options.deployOnly)) {
            api.writeBuildWorkflow(overwrite);
          }
          
          if (options.deployOnly || (!options.testOnly && !options.buildOnly)) {
            api.writeDeployWorkflow(overwrite);
          }
          
          console.log("\nâœ… All workflow files written successfully!");
        } catch (error) {
          console.error("âŒ Failed to write workflow files:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
    },
  ];
}
