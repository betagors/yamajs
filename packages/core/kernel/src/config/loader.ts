
/**
 * Configuration Loader for Yama
 * 
 * Implements priority-based config resolution:
 * 1. CLI Flags (highest)
 * 2. Environment Variables
 * 3. .env.local
 * 4. .env.{environment}
 * 5. .env
 * 6. yama.{environment}.yaml
 * 7. yama.yaml values
 * 8. Schema defaults (lowest)
 */

import { getRuntime } from "../platform/index.js";
import { loadEnvFile } from "../env.js"; // Now async
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
    const env = getRuntime().env;
    return explicit ?? env.get("NODE_ENV") ?? "development";
}

/**
 * Load environment-specific YAML config if it exists
 */
async function loadEnvironmentYaml(
    basePath: string,
    environment: string
): Promise<Record<string, unknown> | null> {
    const fs = getRuntime().fs;
    const path = getRuntime().path;

    const dir = path.dirname(basePath);
    const ext = path.extname(basePath);
    const base = path.basename(basePath, ext);

    // Try yama.{environment}.yaml
    const envPath = path.join(dir, `${base}.${environment}${ext}`);

    if (await fs.exists(envPath)) {
        try {
            const content = await fs.readTextFile(envPath);
            // Note: Parser logic belongs in CLI/Runtime
            return { _rawYaml: content, _path: envPath };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Load and validate configuration with full priority cascade
 */
export async function loadConfig(
    schema: ConfigSchema,
    options: ConfigLoaderOptions = {}
): Promise<ResolvedConfig> {
    const {
        configPath,
        environment = getCurrentEnvironment(),
        cliOverrides = {},
        throwOnError = true,
    } = options;

    // Step 1: Load .env files (Async)
    if (configPath) {
        await loadEnvFile(configPath, environment);
    }

    // Step 2: Build sources map
    const sources: Record<string, string | undefined> = {};

    // Add CLI overrides (highest priority)
    for (const [key, value] of Object.entries(cliOverrides)) {
        sources[key] = value;
    }

    // Step 3: Validate
    if (throwOnError) {
        return validateConfigOrThrow(schema, `${environment}`);
    }

    const result = validateConfig(schema, sources);
    return result.resolved;
}

/**
 * Create a config object from yama.yaml config section
 */
export async function loadConfigFromYaml(
    configSection: YamaConfigSection,
    options: ConfigLoaderOptions = {}
): Promise<ResolvedConfig> {
    const schema = configSection.schema ?? {};
    const staticValues = configSection.values ?? {};

    // First, load and validate schema-defined vars (Async)
    const resolved = await loadConfig(schema, options);

    // Merge with static values
    const result: ResolvedConfig = { ...staticValues };

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
