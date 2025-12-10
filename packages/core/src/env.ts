import { tryGetFileSystem, tryGetPathModule } from "./platform/fs.js";
import { getEnvProvider } from "./platform/env.js";

/**
 * Determines the current environment from explicit parameter, NODE_ENV, or default
 */
function getEnvironment(explicitEnv?: string): string {
  const env = getEnvProvider();
  return explicitEnv || env.getEnv("NODE_ENV") || "development";
}

/**
 * Finds the directory containing .env files by searching up from the config path
 */
function findEnvDirectory(configPath?: string): string | null {
  const pathModule = tryGetPathModule();
  const fs = tryGetFileSystem();
  if (!pathModule || !fs) {
    return null;
  }

  let searchDir = configPath ? pathModule.dirname(pathModule.resolve(configPath)) : getEnvProvider().cwd();
  const rootDir = pathModule.resolve(getEnvProvider().cwd(), "../../");

  while (searchDir !== rootDir && searchDir !== pathModule.dirname(searchDir)) {
    const envPath = pathModule.join(searchDir, ".env");
    if (fs.existsSync(envPath)) {
      return searchDir;
    }
    searchDir = pathModule.dirname(searchDir);
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
export function loadEnvFile(configPath?: string, environment?: string): void {
  const fs = tryGetFileSystem();
  const pathModule = tryGetPathModule();
  if (!fs || !pathModule) {
    return;
  }

  const env = getEnvironment(environment);
  const envDir = findEnvDirectory(configPath);

  if (!envDir) {
    return; // No .env files found
  }

  // Load in priority order (later files override earlier ones)
  const envFiles = [
    pathModule.join(envDir, ".env"),              // Base configuration
    pathModule.join(envDir, `.env.${env}`),       // Environment-specific
    pathModule.join(envDir, ".env.local"),        // Local overrides (highest priority)
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      loadEnvFromFile(envFile);
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
function loadEnvFromFile(filePath: string): void {
  const fs = tryGetFileSystem();
  if (!fs) {
    return;
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (parsed) {
        const [key, value] = parsed;
        // Set the value (allowing .env files to override each other in priority order)
        const env = getEnvProvider();
        env.setEnv?.(key, value);
      }
    }
  } catch {
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
    const envValue = getEnvProvider().getEnv(varName);
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


