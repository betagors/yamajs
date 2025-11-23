import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import yaml from "js-yaml";

/**
 * Read and parse yama.yaml
 */
export function readYamaConfig(configPath: string): unknown {
  try {
    const content = readFileSync(configPath, "utf-8");
    return yaml.load(content);
  } catch (error) {
    throw new Error(`Failed to read yama.yaml: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write yama.yaml
 */
export function writeYamaConfig(configPath: string, config: unknown): void {
  try {
    const content = yaml.dump(config, { indent: 2 });
    writeFileSync(configPath, content, "utf-8");
  } catch (error) {
    throw new Error(`Failed to write yama.yaml: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read package.json
 */
export function readPackageJson(path: string = "package.json"): Record<string, unknown> {
  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write package.json
 */
export function writePackageJson(path: string, pkg: Record<string, unknown>): void {
  try {
    const content = JSON.stringify(pkg, null, 2) + "\n";
    writeFileSync(path, content, "utf-8");
  } catch (error) {
    throw new Error(`Failed to write package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the directory containing yama.yaml
 */
export function getConfigDir(configPath: string): string {
  return dirname(configPath);
}

