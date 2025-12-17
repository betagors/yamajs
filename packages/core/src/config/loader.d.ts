/**
 * Configuration Loader for Yama
 *
 * Implements priority-based config resolution:
 * 1. CLI Flags (highest)
 * 2. Environment Variables (process.env)
 * 3. .env.local
 * 4. .env.{environment}
 * 5. .env
 * 6. yama.{environment}.yaml
 * 7. yama.yaml values
 * 8. Schema defaults (lowest)
 */
import type { ConfigSchema, YamaConfigSection, ResolvedConfig } from "./types.js";
/**
 * Options for loading configuration
 */
export interface ConfigLoaderOptions {
    /**
     * Path to the yama.yaml config file
     */
    configPath?: string;
    /**
     * Environment name (default: NODE_ENV or 'development')
     */
    environment?: string;
    /**
     * CLI-provided overrides (highest priority)
     */
    cliOverrides?: Record<string, string>;
    /**
     * Whether to throw on validation errors (default: true)
     */
    throwOnError?: boolean;
}
/**
 * Get the current environment name
 */
export declare function getCurrentEnvironment(explicit?: string): string;
/**
 * Load and validate configuration with full priority cascade
 *
 * @param schema - Configuration schema to validate against
 * @param options - Loader options
 * @returns Resolved and validated configuration
 */
export declare function loadConfig(schema: ConfigSchema, options?: ConfigLoaderOptions): ResolvedConfig;
/**
 * Create a config object from yama.yaml config section
 *
 * @param configSection - The 'config' section from yama.yaml
 * @param options - Loader options
 * @returns Resolved configuration
 */
export declare function loadConfigFromYaml(configSection: YamaConfigSection, options?: ConfigLoaderOptions): ResolvedConfig;
/**
 * Check if all required config variables are available
 * (Non-throwing version for checks)
 */
export declare function isConfigValid(schema: ConfigSchema): boolean;
/**
 * Get list of missing required config variables
 */
export declare function getMissingConfig(schema: ConfigSchema): string[];
//# sourceMappingURL=loader.d.ts.map