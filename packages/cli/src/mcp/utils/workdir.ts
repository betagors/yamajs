import { existsSync } from "fs";
import { resolve, dirname } from "path";

/**
 * Get the working directory for MCP operations
 * Supports YAMA_MCP_WORKDIR environment variable for monorepo setups
 */
export function getMCPWorkingDir(): string {
  // Check for explicit working directory (useful for monorepos)
  if (process.env.YAMA_MCP_WORKDIR) {
    return resolve(process.env.YAMA_MCP_WORKDIR);
  }
  // Check for explicit config path
  if (process.env.YAMA_CONFIG_PATH) {
    const configPath = resolve(process.env.YAMA_CONFIG_PATH);
    // If it's a file, return its directory; if it's a directory, use it
    if (existsSync(configPath)) {
      try {
        const { statSync } = require("fs");
        const stats = statSync(configPath);
        return stats.isFile() ? dirname(configPath) : configPath;
      } catch {
        // Fall through to default
      }
    }
  }
  return process.cwd();
}













