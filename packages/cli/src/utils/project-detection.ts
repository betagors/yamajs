import { existsSync } from "fs";
import { join, dirname } from "path";

export type ProjectType = "nextjs" | "vite" | "react" | "node" | "unknown";

/**
 * Detect the project type based on configuration files
 */
export function detectProjectType(cwd: string = process.cwd()): ProjectType {
  if (existsSync(join(cwd, "next.config.ts")) || 
      existsSync(join(cwd, "next.config.ts")) ||
      existsSync(join(cwd, "next.config.mjs"))) {
    return "nextjs";
  }
  
  if (existsSync(join(cwd, "vite.config.ts")) || 
      existsSync(join(cwd, "vite.config.ts"))) {
    return "vite";
  }
  
  if (existsSync(join(cwd, "package.json"))) {
    // Check for React in package.json
    try {
      const pkg = require(join(cwd, "package.json"));
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        return "react";
      }
    } catch {
      // Ignore errors
    }
    return "node";
  }
  
  return "unknown";
}

/**
 * Infer the output path for generated files based on project type
 * Now uses .yama/ directory structure
 */
export function inferOutputPath(
  projectType: ProjectType,
  type: "types" | "sdk" = "types"
): string {
  // All projects now use .yama/ structure
  return type === "types"
    ? ".yama/types.ts"
    : ".yama/sdk/client.ts";
}

/**
 * Find yama.yaml or yama.yml in the current directory or parent directories
 */
export function findYamaConfig(startPath: string = process.cwd()): string | null {
  let current = startPath;
  const startDir = current;
  
  while (current !== dirname(current)) {
    // Try yama.yml first (preferred)
    const configPathYml = join(current, "yama.yml");
    if (existsSync(configPathYml)) {
      return configPathYml;
    }
    
    // Fall back to yama.yaml (backward compat)
    const configPathYaml = join(current, "yama.yaml");
    if (existsSync(configPathYaml)) {
      return configPathYaml;
    }
    
    current = dirname(current);
  }
  
  // Check current directory one more time
  const configPathYml = join(startDir, "yama.yml");
  if (existsSync(configPathYml)) {
    return configPathYml;
  }
  
  const configPathYaml = join(startDir, "yama.yaml");
  if (existsSync(configPathYaml)) {
    return configPathYaml;
  }
  
  return null;
}

