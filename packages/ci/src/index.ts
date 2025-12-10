export { default } from "./plugin.js";
export type { CIPluginAPI } from "./plugin.js";
export type {
  CIPluginConfig,
  CIProjectInfo,
} from "./types.js";
export {
  detectPackageManager,
  detectTestFramework,
  getCIProjectInfo,
  generateTestWorkflow,
  generateBuildWorkflow,
  generateDeployWorkflow,
  ensureWorkflowsDir,
} from "./generator.js";
export { createCICommands } from "./commands.js";
export { createCIMCPTools } from "./mcp-tools.js";
