import { existsSync, readFileSync } from "fs";
import { join, dirname, resolve } from "path";
/**
 * Determines the current environment from explicit parameter, NODE_ENV, or default
 */
function getEnvironment(explicitEnv) {
    return explicitEnv || process.env.NODE_ENV || "development";
}
/**
 * Finds the directory containing .env files by searching up from the config path
 */
function findEnvDirectory(configPath) {
    let searchDir = configPath ? dirname(resolve(configPath)) : process.cwd();
    const rootDir = resolve(process.cwd(), "../../");
    while (searchDir !== rootDir && searchDir !== dirname(searchDir)) {
        const envPath = join(searchDir, ".env");
        if (existsSync(envPath)) {
            return searchDir;
        }
        searchDir = dirname(searchDir);
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
export function loadEnvFile(configPath, environment) {
    const env = getEnvironment(environment);
    const envDir = findEnvDirectory(configPath);
    if (!envDir) {
        return; // No .env files found
    }
    // Load in priority order (later files override earlier ones)
    const envFiles = [
        join(envDir, ".env"), // Base configuration
        join(envDir, `.env.${env}`), // Environment-specific
        join(envDir, ".env.local"), // Local overrides (highest priority)
    ];
    for (const envFile of envFiles) {
        if (existsSync(envFile)) {
            loadEnvFromFile(envFile);
        }
    }
}
/**
 * Parses a single line from .env file
 * Returns [key, value] tuple or null if line is invalid
 */
function parseEnvLine(line) {
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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    return [key, value];
}
/**
 * Load environment variables from a specific file
 * Variables are loaded in order, so later files can override earlier ones
 * Note: process.env variables set before loadEnvFile() still take precedence
 */
function loadEnvFromFile(filePath) {
    try {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
            const parsed = parseEnvLine(line);
            if (parsed) {
                const [key, value] = parsed;
                // Set the value (allowing .env files to override each other in priority order)
                process.env[key] = value;
            }
        }
    }
    catch {
        // Silently fail if .env file can't be read
        // This allows the app to work without .env files
    }
}
/**
 * Resolve environment variable references in strings
 * Supports ${VAR_NAME} syntax
 */
export function resolveEnvVar(value) {
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
export function resolveEnvVars(obj) {
    if (typeof obj === "string") {
        try {
            return resolveEnvVar(obj);
        }
        catch {
            return obj;
        }
    }
    if (Array.isArray(obj)) {
        return obj.map(resolveEnvVars);
    }
    if (obj && typeof obj === "object") {
        const resolved = {};
        for (const [key, value] of Object.entries(obj)) {
            resolved[key] = resolveEnvVars(value);
        }
        return resolved;
    }
    return obj;
}
//# sourceMappingURL=env.js.map