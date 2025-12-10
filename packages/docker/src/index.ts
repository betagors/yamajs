export { default } from "./plugin.js";
export type { DockerPluginAPI } from "./plugin.js";
export type {
  DockerPluginConfig,
  DockerComposeConfig,
  DockerComposeService,
  ProjectInfo,
} from "./types.js";
export {
  detectPackageManager,
  detectNodeVersion,
  getProjectInfo,
  generateDockerfile,
  generateDockerCompose,
  generateDockerIgnore,
} from "./generator.js";
export { createDockerCommands } from "./commands.js";
export { createDockerMCPTools } from "./mcp-tools.js";
export { interactiveDockerComposeSetup } from "./interactive.js";
export type { DevToolsSelection } from "./interactive.js";




