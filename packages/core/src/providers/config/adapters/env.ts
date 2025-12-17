/**
 * Config Provider - ENV Adapter
 * 
 * Loads configuration from environment variables and .env files.
 * This is the first provider to initialize - all other providers depend on it.
 * 
 * Features:
 * - Loads .env, .env.local, .env.{NODE_ENV} files
 * - Provides ${VAR:default} substitution helper
 * - No external dependencies (parses .env format directly)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
    Provider,
    ProviderContext,
    ConfigProviderConfig,
    ConfigAPI,
} from '../../types.js';
import { registerAdapter } from '../../registry.js';

// ============================================================================
// .env Parser (zero dependencies)
// ============================================================================

/**
 * Parse .env file content into key-value pairs
 * Handles:
 * - Comments (# lines)
 * - Quoted values (single and double)
 * - Multi-line values (with quotes)
 * - Variable references (${VAR})
 */
function parseEnvContent(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    let currentKey: string | null = null;
    let currentValue = '';
    let inQuote: '"' | "'" | null = null;

    for (const rawLine of lines) {
        let line = rawLine.trim();

        // Skip empty lines and comments (when not in multi-line value)
        if (!inQuote) {
            if (line === '' || line.startsWith('#')) {
                continue;
            }
        }

        // Continue multi-line value
        if (inQuote && currentKey) {
            currentValue += '\n' + rawLine;

            // Check for closing quote
            if (rawLine.trimEnd().endsWith(inQuote)) {
                // Remove closing quote
                currentValue = currentValue.slice(0, -1);
                result[currentKey] = currentValue;
                currentKey = null;
                currentValue = '';
                inQuote = null;
            }
            continue;
        }

        // Parse KEY=VALUE
        const equalsIndex = line.indexOf('=');
        if (equalsIndex === -1) {
            continue; // Invalid line
        }

        const key = line.slice(0, equalsIndex).trim();
        let value = line.slice(equalsIndex + 1);

        // Handle quoted values
        if (value.startsWith('"') || value.startsWith("'")) {
            const quote = value[0] as '"' | "'";
            value = value.slice(1); // Remove opening quote

            // Check if single-line quoted value
            const closingIndex = value.lastIndexOf(quote);
            if (closingIndex > 0 && value.endsWith(quote)) {
                // Single-line quoted value
                value = value.slice(0, -1);
                result[key] = value;
            } else {
                // Multi-line quoted value
                currentKey = key;
                currentValue = value;
                inQuote = quote;
            }
        } else {
            // Unquoted value - trim and handle inline comments
            const commentIndex = value.indexOf(' #');
            if (commentIndex > 0) {
                value = value.slice(0, commentIndex);
            }
            result[key] = value.trim();
        }
    }

    return result;
}

/**
 * Load .env file if it exists
 */
function loadEnvFile(filePath: string): Record<string, string> {
    if (!existsSync(filePath)) {
        return {};
    }

    try {
        const content = readFileSync(filePath, 'utf-8');
        return parseEnvContent(content);
    } catch {
        return {};
    }
}

// ============================================================================
// Variable Substitution
// ============================================================================

/**
 * Substitute ${VAR} and ${VAR:default} in a string value
 * Uses the provided values map, falling back to process.env
 */
export function substituteVariables(
    value: string,
    values: Record<string, string | undefined>
): string {
    // Match ${VAR} or ${VAR:default}
    return value.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (match, varName, defaultValue) => {
        const envValue = values[varName] ?? process.env[varName];

        if (envValue !== undefined) {
            return envValue;
        }

        if (defaultValue !== undefined) {
            return defaultValue;
        }

        // Return original if no value and no default
        return match;
    });
}

/**
 * Check if a string contains unresolved required variables
 */
export function hasUnresolvedVariables(value: string): boolean {
    // Match ${VAR} without default value
    const matches = value.match(/\$\{([^}:]+)\}/g);
    return matches !== null && matches.length > 0;
}

// ============================================================================
// ENV Config Provider
// ============================================================================

class EnvConfigProvider implements Provider<ConfigProviderConfig, ConfigAPI> {
    readonly type = 'config' as const;
    readonly adapter = 'env';
    readonly version = '1.0.0';

    private api: ConfigAPI | null = null;
    private values: Record<string, string> = {};
    private env: 'development' | 'production' | 'test' = 'development';

    async init(config: ConfigProviderConfig, context: ProviderContext): Promise<ConfigAPI> {
        const { projectDir } = context;

        // Determine environment
        const nodeEnv = process.env.NODE_ENV || 'development';
        this.env = nodeEnv === 'production' ? 'production'
            : nodeEnv === 'test' ? 'test'
                : 'development';

        // Load .env files in order (later files override earlier)
        // 1. .env (base)
        // 2. .env.local (local overrides, gitignored)
        // 3. .env.{environment} (environment-specific)
        // 4. .env.{environment}.local (local env-specific, gitignored)

        const envFiles = [
            join(projectDir, '.env'),
            join(projectDir, '.env.local'),
            join(projectDir, `.env.${this.env}`),
            join(projectDir, `.env.${this.env}.local`),
        ];

        // Custom paths from config
        if (config.paths) {
            for (const path of config.paths) {
                envFiles.push(join(projectDir, path));
            }
        }

        // Load and merge all env files
        this.values = {};
        for (const file of envFiles) {
            const fileValues = loadEnvFile(file);
            Object.assign(this.values, fileValues);

            if (Object.keys(fileValues).length > 0) {
                context.log.debug(`Loaded env file: ${file}`, {
                    keyCount: Object.keys(fileValues).length
                });
            }
        }

        // Override with actual process.env (highest priority)
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined) {
                this.values[key] = value;
            }
        }

        context.log.info(`Config provider loaded ${Object.keys(this.values).length} variables`);

        // Create API
        this.api = {
            get: <T = string>(key: string, defaultValue?: T): T | undefined => {
                const value = this.values[key];
                if (value !== undefined) {
                    return value as unknown as T;
                }
                return defaultValue;
            },

            getRequired: <T = string>(key: string): T => {
                const value = this.values[key];
                if (value === undefined) {
                    throw new Error(`Required config '${key}' is not set. Please set it in your .env file or environment.`);
                }
                return value as unknown as T;
            },

            has: (key: string): boolean => {
                return this.values[key] !== undefined;
            },

            getAll: (): Record<string, unknown> => {
                // Return a copy to prevent modification
                return { ...this.values };
            },

            env: this.env,
            isDev: this.env === 'development',
            isProd: this.env === 'production',
            isTest: this.env === 'test',
        };

        return this.api;
    }

    getAPI(): ConfigAPI {
        if (!this.api) {
            throw new Error('Config provider not initialized. Call init() first.');
        }
        return this.api;
    }

    isInitialized(): boolean {
        return this.api !== null;
    }

    async healthCheck() {
        return {
            healthy: true,
            details: {
                variableCount: Object.keys(this.values).length,
                environment: this.env,
            },
        };
    }

    // No shutdown needed for config provider
}

// ============================================================================
// Register Adapter
// ============================================================================

registerAdapter('config', 'env', () => new EnvConfigProvider());

// ============================================================================
// Exports
// ============================================================================

export { EnvConfigProvider };
export { parseEnvContent, loadEnvFile };
