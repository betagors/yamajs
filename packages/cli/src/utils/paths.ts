import { join, dirname, relative, resolve } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

/**
 * Get the .yama directory path
 */
export function getYamaDir(configDir: string): string {
  return join(configDir, ".yama");
}

/**
 * Get the database code directory path
 */
export function getDbDir(configDir: string): string {
  return join(configDir, ".yama", "db");
}

/**
 * Get the SDK directory path
 */
export function getSdkDir(configDir: string): string {
  return join(configDir, ".yama", "sdk");
}

/**
 * Get the types file path
 */
export function getTypesPath(configDir: string): string {
  return join(configDir, ".yama", "types.ts");
}

/**
 * Get the migrations directory path (at root, not in .yama)
 */
export function getMigrationsDir(configDir: string): string {
  return join(configDir, "migrations");
}

/**
 * Get the cache directory path
 */
export function getCacheDir(configDir: string): string {
  return join(configDir, ".yama", "cache");
}

/**
 * Get the path to the Yama YAML schema file for autocomplete
 * Returns a relative path from the yama.yaml file location to the schema
 */
export function getYamaSchemaPath(yamaYamlPath: string): string {
  const yamaYamlDir = dirname(yamaYamlPath);
  
  // Try to find the schema in node_modules
  // First, try to find node_modules relative to the yama.yaml file
  let currentDir = yamaYamlDir;
  const root = resolve(currentDir, "..", "..", "..", "..");
  
  while (currentDir !== root && currentDir !== dirname(currentDir)) {
    const nodeModulesPath = join(currentDir, "node_modules", "@yama", "cli", "dist", "cli", "src", "yama.schema.json");
    if (existsSync(nodeModulesPath)) {
      // Return relative path from yama.yaml to schema
      return relative(yamaYamlDir, nodeModulesPath).replace(/\\/g, "/");
    }
    
    // Also try the source location (for development)
    const srcPath = join(currentDir, "node_modules", "@yama", "cli", "src", "yama.schema.json");
    if (existsSync(srcPath)) {
      return relative(yamaYamlDir, srcPath).replace(/\\/g, "/");
    }
    
    // Check if we're in a monorepo and the package is in packages/
    const monorepoPath = join(currentDir, "packages", "cli", "src", "yama.schema.json");
    if (existsSync(monorepoPath)) {
      return relative(yamaYamlDir, monorepoPath).replace(/\\/g, "/");
    }
    
    currentDir = dirname(currentDir);
  }
  
  // Fallback: try to resolve from the current package location
  try {
    // Get the directory of this file (paths.ts)
    const currentFile = fileURLToPath(import.meta.url);
    const packageDir = dirname(dirname(dirname(currentFile)));
    const schemaPath = join(packageDir, "src", "yama.schema.json");
    
    if (existsSync(schemaPath)) {
      return relative(yamaYamlDir, schemaPath).replace(/\\/g, "/");
    }
  } catch {
    // Ignore errors
  }
  
  // Last resort: return a node_modules path (editor will try to resolve it)
  return "node_modules/@yama/cli/dist/cli/src/yama.schema.json";
}

