import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import yaml from "js-yaml";

/**
 * YAML parsing error with line number information
 */
export interface YAMLError extends Error {
  mark?: {
    line: number;
    column: number;
    buffer?: string;
    pointer?: number;
  };
  line?: number;
  column?: number;
}

/**
 * Read and parse yama.yaml
 * @throws {Error} with line number information if parsing fails
 */
export function readYamaConfig(configPath: string): unknown {
  try {
    const content = readFileSync(configPath, "utf-8");
    return yaml.load(content);
  } catch (error) {
    const yamlError = error as YAMLError;
    let errorMessage = `Failed to read yama.yaml: ${yamlError.message || String(error)}`;
    
    // Extract line number from js-yaml error
    if (yamlError.mark) {
      const line = yamlError.mark.line + 1; // js-yaml uses 0-based, we want 1-based
      const column = yamlError.mark.column + 1;
      errorMessage += `\n  at line ${line}, column ${column}`;
    } else if (yamlError.line !== undefined) {
      errorMessage += `\n  at line ${yamlError.line + 1}`;
    }
    
    const enhancedError = new Error(errorMessage) as YAMLError;
    enhancedError.mark = yamlError.mark;
    enhancedError.line = yamlError.line;
    enhancedError.column = yamlError.column;
    throw enhancedError;
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

