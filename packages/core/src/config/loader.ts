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

import { tryGetFileSystem, tryGetPathModule } from "../platform/fs.js";
import { getEnvProvider } from "../platform/env.js";
import { loadEnvFile, resolveEnvVars } from "../env.js";
import type {
    ConfigSchema,
    YamaConfigSection,
    ResolvedConfig
} from "./types.js";
import { validateConfig, validateConfigOrThrow } from "./validator.js";

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
export function getCurrentEnvironment(explicit?: string): string {
    const env = getEnvProvider();
    return explicit ?? env.getEnv("NODE_ENV") ?? "development";
}

/**
 * Load environment-specific YAML config if it exists
 */
function loadEnvironmentYaml(
    basePath: string,
    environment: string
): Record<string, unknown> | null {
    const fs = tryGetFileSystem();
    const pathModule = tryGetPathModule();

    if (!fs || !pathModule) {
        return null;
    }

    // Check if required optional methods exist
    if (!pathModule.extname || !pathModule.basename) {
        return null;
    }

    const dir = pathModule.dirname(basePath);
    const ext = pathModule.extname(basePath);
    const base = pathModule.basename(basePath, ext);

    // Try yama.{environment}.yaml
    const envPath = pathModule.join(dir, `${base}.${environment}${ext}`);

    if (fs.existsSync(envPath)) {
        try {
            const content = fs.readFileSync(envPath, "utf-8");
            // Note: Actual YAML parsing would happen in the CLI/node package
            // This returns raw content for now
            return { _rawYaml: content, _path: envPath };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Merge config objects with later values overriding earlier ones
 */
function mergeConfigs(...configs: (Record<string, unknown> | null | undefined)[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const config of configs) {
        if (config) {
            Object.assign(result, config);
        }
    }

    return result;
}

/**
 * Load and validate configuration with full priority cascade
 * 
 * @param schema - Configuration schema to validate against
 * @param options - Loader options
 * @returns Resolved and validated configuration
 */
export function loadConfig(
    schema: ConfigSchema,
    options: ConfigLoaderOptions = {}
): ResolvedConfig {
    const {
        configPath,
        environment = getCurrentEnvironment(),
        cliOverrides = {},
        throwOnError = true,
    } = options;

    // Step 1: Load .env files (they modify process.env)
    if (configPath) {
        loadEnvFile(configPath, environment);
    }

    // Step 2: Build sources map with priority
    // CLI overrides are merged last (highest priority) when we validate
    const sources: Record<string, string | undefined> = {};

    // Add CLI overrides (highest priority)
    for (const [key, value] of Object.entries(cliOverrides)) {
        sources[key] = value;
    }

    // Environment variables are read directly from getEnvProvider() in validator
    // So we only pass CLI overrides as explicit sources

    // Step 3: Validate
    if (throwOnError) {
        return validateConfigOrThrow(schema, `${environment}`);
    }

    const result = validateConfig(schema, sources);
    return result.resolved;
}

/**
 * Create a config object from yama.yaml config section
 * 
 * @param configSection - The 'config' section from yama.yaml
 * @param options - Loader options
 * @returns Resolved configuration
 */
export function loadConfigFromYaml(
    configSection: YamaConfigSection,
    options: ConfigLoaderOptions = {}
): ResolvedConfig {
    const schema = configSection.schema ?? {};
    const staticValues = configSection.values ?? {};

    // First, load and validate schema-defined vars
    const resolved = loadConfig(schema, options);

    // Then merge with static values (static values have lower priority)
    const result: ResolvedConfig = { ...staticValues };

    // Resolved schema values override static values
    for (const [key, value] of Object.entries(resolved)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Check if all required config variables are available
 * (Non-throwing version for checks)
 */
export function isConfigValid(schema: ConfigSchema): boolean {
    const result = validateConfig(schema);
    return result.valid;
}

/**
 * Get list of missing required config variables
 */
export function getMissingConfig(schema: ConfigSchema): string[] {
    const result = validateConfig(schema);
    return result.errors
        .filter(e => e.message.includes("Missing required"))
        .map(e => e.key);
}
