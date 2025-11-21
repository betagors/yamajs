import { existsSync, readFileSync } from "fs";
import { join, dirname, resolve } from "path";

/**
 * Load environment variables from .env file
 * Looks for .env in the current directory and parent directories up to the project root
 */
export function loadEnvFile(configPath?: string): void {
  // If configPath is provided, start from that directory
  // Otherwise, start from process.cwd()
  let searchDir = configPath ? dirname(resolve(configPath)) : process.cwd();
  const rootDir = resolve(process.cwd(), "../../"); // Stop at monorepo root

  // Search up the directory tree for .env file
  while (searchDir !== rootDir && searchDir !== dirname(searchDir)) {
    const envPath = join(searchDir, ".env");
    const envLocalPath = join(searchDir, ".env.local");

    // Prefer .env.local over .env
    if (existsSync(envLocalPath)) {
      loadEnvFromFile(envLocalPath);
      return;
    }

    if (existsSync(envPath)) {
      loadEnvFromFile(envPath);
      return;
    }

    searchDir = dirname(searchDir);
  }
}

/**
 * Load environment variables from a specific file
 */
function loadEnvFromFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Only set if not already in process.env (existing env vars take precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    // Silently fail if .env file can't be read
    // This allows the app to work without .env files
  }
}

/**
 * Resolve environment variable references in strings
 * Supports ${VAR_NAME} syntax
 */
export function resolveEnvVar(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not set`);
    }
    return envValue;
  });
}

/**
 * Resolve environment variables in an object recursively
 */
export function resolveEnvVars<T>(obj: T): T {
  if (typeof obj === "string") {
    try {
      return resolveEnvVar(obj) as T;
    } catch {
      return obj;
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVars) as T;
  }

  if (obj && typeof obj === "object") {
    const resolved = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      (resolved as Record<string, unknown>)[key] = resolveEnvVars(value);
    }
    return resolved;
  }

  return obj;
}

