
import { getRuntime } from "../../../../../../../../../../core/kernel/src/platform/index.js";

/**
 * Determines the current environment from explicit parameter, NODE_ENV, or default
 */
function getEnvironment(explicitEnv?: string): string {
  const env = getRuntime().env;
  return explicitEnv || env.get("NODE_ENV") || "development";
}

/**
 * Finds the directory containing .env files by searching up from the config path
 */
async function findEnvDirectory(configPath?: string): Promise<string | null> {
  const path = getRuntime().path;
  const fs = getRuntime().fs;
  const cwd = getRuntime().env.cwd();

  let searchDir = configPath ? path.dirname(path.resolve(configPath)) : cwd;
  const rootDir = path.resolve(cwd, "../../"); // Heuristic for monorepo root? Or just system root?

  // Safety break for root
  let previousDir = '';

  while (searchDir !== rootDir && searchDir !== previousDir) {
    const envPath = path.join(searchDir, ".env");
    if (await fs.exists(envPath)) {
      return searchDir;
    }
    previousDir = searchDir;
    searchDir = path.dirname(searchDir);
  }

  return null;
}

/**
 * Load environment variables from .env files
 * 
 * Supports environment-specific files with proper priority order:
 * 1. .env (base/default values)
 * 2. .env.{environment} (environment-specific overrides, e.g., .env.development)
 * 3. .env.local (local overrides, highest priority, usually gitignored)
 * 
 * @param configPath - Optional path to config file (used to determine search directory)
 * @param environment - Optional environment name (e.g., 'development', 'production', 'staging')
 *                      If not provided, uses NODE_ENV or defaults to 'development'
 */
export async function loadEnvFile(configPath?: string, environment?: string): Promise<void> {
  const envName = getEnvironment(environment);
  const envDir = await findEnvDirectory(configPath);
  const path = getRuntime().path;
  const fs = getRuntime().fs;

  if (!envDir) {
    return; // No .env files found
  }

  // Load in priority order (later files override earlier ones)
  const envFiles = [
    path.join(envDir, ".env"),              // Base configuration
    path.join(envDir, `.env.${envName}`),   // Environment-specific
    path.join(envDir, ".env.local"),        // Local overrides (highest priority)
  ];

  for (const envFile of envFiles) {
    if (await fs.exists(envFile)) {
      await loadEnvFromFile(envFile);
    }
  }
}

/**
 * Parses a single line from .env file
 * Returns [key, value] tuple or null if line is invalid
 */
function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  // Parse KEY=VALUE format
  const match = trimmed.match(/^([^=:#]+)=(.*)$/);
  if (!match) {
    return null;
  }

  const key = match[1].trim();
  let value = match[2].trim();

  // Remove quotes if present (supports both single and double quotes)
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

/**
 * Load environment variables from a specific file
 * Variables are loaded in order, so later files can override earlier ones
 * Note: process.env variables set before loadEnvFile() still take precedence
 */
async function loadEnvFromFile(filePath: string): Promise<void> {
  const fs = getRuntime().fs;
  const env = getRuntime().env;

  try {
    const content = await fs.readTextFile(filePath);
    const lines = content.split("\n");

    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (parsed) {
        const [key, value] = parsed;
        // Set the value via runtime adapter
        env.set(key, value);
      }
    }
  } catch {
    // Silently fail if .env file can't be read
  }
}

/**
 * Resolve environment variable references in strings
 * Supports ${VAR_NAME} syntax
 */
export function resolveEnvVar(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    const envValue = getRuntime().env.get(varName);
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
