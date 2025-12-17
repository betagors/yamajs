import type { PluginCLICommand } from "@yamajs/core";
import type { DockerPluginAPI } from "./plugin.js";
import { interactiveDockerComposeSetup } from "./interactive.js";

/**
 * Create CLI commands for Docker plugin
 */
export function createDockerCommands(api: DockerPluginAPI, pluginName: string): PluginCLICommand[] {
  return [
    {
      name: "docker generate",
      description: "Generate Dockerfile, docker-compose.yml, and .dockerignore",
      options: [
        {
          flags: "--overwrite",
          description: "Overwrite existing files",
          defaultValue: false,
        },
      ],
      pluginName,
      action: async (options: { overwrite?: boolean }) => {
        const overwrite = options.overwrite || false;
        try {
          console.log("ðŸ³ Generating Docker files...\n");
          
          const dockerfile = api.generateDockerfile();
          const compose = api.generateDockerCompose();
          const dockerignore = api.generateDockerIgnore();
          
          console.log("ðŸ“„ Dockerfile:");
          console.log(dockerfile);
          console.log("\nðŸ“„ docker-compose.yml:");
          console.log(compose);
          console.log("\nðŸ“„ .dockerignore:");
          console.log(dockerignore);
          
          console.log("\nâœ… Docker files generated successfully!");
          console.log("ðŸ’¡ Use 'yama docker write' to write these files to your project.");
        } catch (error) {
          console.error("âŒ Failed to generate Docker files:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
    },
    {
      name: "docker write",
      description: "Write Docker files to project directory",
      options: [
        {
          flags: "--overwrite",
          description: "Overwrite existing files",
          defaultValue: false,
        },
      ],
      pluginName,
      action: async (options: { overwrite?: boolean }) => {
        const overwrite = options.overwrite || false;
        try {
          console.log("ðŸ³ Writing Docker files...\n");
          api.writeAll(overwrite);
          console.log("\nâœ… All Docker files written successfully!");
        } catch (error) {
          console.error("âŒ Failed to write Docker files:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
    },
    {
      name: "docker setup",
      description: "Interactive setup wizard for Docker Compose with dev tools",
      options: [
        {
          flags: "--overwrite",
          description: "Overwrite existing files",
          defaultValue: false,
        },
      ],
      pluginName,
      action: async (options: { overwrite?: boolean }) => {
        const overwrite = options.overwrite || false;
        try {
          // Get project info from API
          const projectInfo = api.getProjectInfo();
          
          // Use inquirer for interactive setup
          const composeConfig = await interactiveDockerComposeSetup(projectInfo);
          
          // Update plugin config with compose settings
          const currentConfig = api.getConfig();
          api.updateConfig({
            ...currentConfig,
            compose: {
              ...currentConfig.compose,
              ...composeConfig,
            },
          });
          
          console.log("\nâœ… Configuration saved!");
          console.log("\nðŸ“‹ Selected services:");
          if (composeConfig.includeDatabase) {
            console.log(`  âœ“ Database: ${composeConfig.databaseType || "postgres"}`);
            if (composeConfig.includePgAdmin) {
              console.log(`  âœ“ pgAdmin: http://localhost:5050`);
            }
            if (composeConfig.includeAdminer) {
              console.log(`  âœ“ Adminer: http://localhost:8080`);
            }
          }
          if (composeConfig.includeRedis) {
            console.log(`  âœ“ Redis: localhost:6379`);
          }
          if (composeConfig.includeMailpit) {
            console.log(`  âœ“ Mailpit: http://localhost:8025 (SMTP: localhost:1025)`);
          }
          
          console.log("\nðŸ’¡ Run 'yama docker write' to generate the docker-compose.yml file.");
        } catch (error) {
          console.error("âŒ Setup failed:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
    },
    {
      name: "docker write-interactive",
      description: "Interactive setup and write Docker files in one step",
      options: [
        {
          flags: "--overwrite",
          description: "Overwrite existing files",
          defaultValue: false,
        },
      ],
      pluginName,
      action: async (options: { overwrite?: boolean }) => {
        const overwrite = options.overwrite || false;
        try {
          // Get project info from API
          const projectInfo = api.getProjectInfo();
          
          // Use inquirer for interactive setup
          const composeConfig = await interactiveDockerComposeSetup(projectInfo);
          
          // Update plugin config with compose settings
          const currentConfig = api.getConfig();
          api.updateConfig({
            ...currentConfig,
            compose: {
              ...currentConfig.compose,
              ...composeConfig,
            },
          });
          
          console.log("\nðŸ“ Writing Docker files...\n");
          api.writeAll(overwrite);
          
          console.log("\nâœ… All Docker files written successfully!");
          console.log("\nðŸ“‹ Services configured:");
          if (composeConfig.includeDatabase) {
            console.log(`  âœ“ Database: ${composeConfig.databaseType || "postgres"}`);
            if (composeConfig.includePgAdmin) {
              console.log(`  âœ“ pgAdmin: http://localhost:5050`);
            }
            if (composeConfig.includeAdminer) {
              console.log(`  âœ“ Adminer: http://localhost:8080`);
            }
          }
          if (composeConfig.includeRedis) {
            console.log(`  âœ“ Redis: localhost:6379`);
          }
          if (composeConfig.includeMailpit) {
            console.log(`  âœ“ Mailpit: http://localhost:8025 (SMTP: localhost:1025)`);
          }
          console.log("\nðŸš€ Run 'docker-compose up' to start your development environment!");
        } catch (error) {
          console.error("âŒ Setup failed:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
    },
  ];
}
