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
export declare function loadEnvFile(configPath?: string, environment?: string): void;
/**
 * Resolve environment variable references in strings
 * Supports ${VAR_NAME} syntax
 */
export declare function resolveEnvVar(value: string): string;
/**
 * Resolve environment variables in an object recursively
 */
export declare function resolveEnvVars<T>(obj: T): T;
