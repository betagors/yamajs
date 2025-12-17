/**
 * Provider Configuration Parser
 * 
 * Parses the `providers:` block from yama.yaml and initializes all providers.
 * This is the entry point for integrating the provider system with the CLI.
 */

import { join, dirname } from 'node:path';
import type { ProvidersConfig, ProviderAPIs } from './types.js';
import { initializeProviders, shutdownProviders, getProvidersHealth } from './registry.js';
import { substituteVariables } from './config/adapters/env.js';

// ============================================================================
// YAML Configuration Parsing
// ============================================================================

/**
 * Raw providers config from YAML (before variable substitution)
 */
export interface RawProvidersConfig {
    config?: {
        adapter?: string;
        paths?: string[];
    };
    logging?: {
        adapter?: string;
        level?: string;
        format?: string;
        redact?: string[];
    };
    database?: {
        adapter?: string;
        path?: string;
        memory?: boolean;
        debug?: boolean;
    };
    cache?: {
        adapter?: string;
        maxSize?: number;
        ttl?: string;
    };
    email?: {
        adapter?: string;
        from?: string;
        smtp?: {
            host?: string;
            port?: number;
            secure?: boolean;
            auth?: {
                user?: string;
                pass?: string;
            };
        };
        templates?: string;
        dev?: {
            capture?: boolean;
            ui?: boolean;
            uiPath?: string;
        };
    };
    auth?: {
        adapter?: string;
        jwt?: {
            secret?: string;
            accessTokenExpiry?: string;
            refreshTokenExpiry?: string;
        };
        password?: {
            minLength?: number;
            maxLength?: number;
            requireUppercase?: boolean;
            requireLowercase?: boolean;
            requireNumber?: boolean;
            requireSpecial?: boolean;
            denyCommon?: boolean;
            checkBreached?: boolean;
        };
        rateLimit?: {
            enabled?: boolean;
            login?: {
                maxAttempts?: number;
                window?: string;
                blockDuration?: string;
            };
            signup?: {
                maxAttempts?: number;
                window?: string;
            };
        };
        lockout?: {
            enabled?: boolean;
            maxAttempts?: number;
            duration?: string;
            notifyEmail?: boolean;
        };
    };
    storage?: {
        adapter?: string;
        path?: string;
        maxFileSize?: string | number;
        allowedTypes?: string[];
        serve?: {
            enabled?: boolean;
            path?: string;
        };
    };
}

/**
 * Parse YAML provider configuration and substitute environment variables
 */
export function parseProvidersConfig(
    rawConfig: RawProvidersConfig | undefined,
    envVars: Record<string, string>
): ProvidersConfig {
    if (!rawConfig) {
        return {};
    }

    // Deep substitute environment variables in the config
    const substituted = substituteEnvVarsDeep(rawConfig, envVars);

    return substituted as ProvidersConfig;
}

/**
 * Recursively substitute environment variables in an object
 */
function substituteEnvVarsDeep<T>(obj: T, envVars: Record<string, string>): T {
    if (typeof obj === 'string') {
        return substituteVariables(obj, envVars) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => substituteEnvVarsDeep(item, envVars)) as T;
    }

    if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = substituteEnvVarsDeep(value, envVars);
        }
        return result as T;
    }

    return obj;
}

// ============================================================================
// Provider System Integration
// ============================================================================

let currentProviders: ProviderAPIs | null = null;

/**
 * Initialize the provider system from yama.yaml configuration
 * 
 * @param rawConfig - The raw providers config from yama.yaml
 * @param projectDir - The project root directory (where yama.yaml is located)
 * @param envVars - Environment variables (from process.env or parsed .env files)
 */
export async function initializeProvidersFromConfig(
    rawConfig: RawProvidersConfig | undefined,
    projectDir: string,
    envVars: Record<string, string> = process.env as Record<string, string>
): Promise<ProviderAPIs> {
    // Parse config with environment variable substitution
    const config = parseProvidersConfig(rawConfig, envVars);

    // Initialize all providers
    currentProviders = await initializeProviders(config, projectDir);

    return currentProviders;
}

/**
 * Get the current initialized providers
 */
export function getProviders(): ProviderAPIs | null {
    return currentProviders;
}

/**
 * Shutdown the provider system
 */
export async function shutdownProvidersSystem(): Promise<void> {
    await shutdownProviders();
    currentProviders = null;
}

/**
 * Get health status of all providers
 */
export async function getProviderSystemHealth() {
    return getProvidersHealth();
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Get default provider configuration when no providers block is specified
 */
export function getDefaultProvidersConfig(): ProvidersConfig {
    return {
        config: {
            adapter: 'env',
        },
        logging: {
            adapter: 'console',
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        },
        database: {
            adapter: 'pglite',
            memory: process.env.NODE_ENV === 'test',
        },
        cache: {
            adapter: 'memory',
            maxSize: 1000,
        },
        email: {
            adapter: 'smtp',
            from: 'noreply@example.com',
            dev: {
                capture: process.env.NODE_ENV !== 'production',
            },
        },
        auth: {
            adapter: 'jwt-password',
            jwt: {
                secret: process.env.JWT_SECRET || '',
                accessTokenExpiry: '15m',
                refreshTokenExpiry: '30d',
            },
        },
        storage: {
            adapter: 'local',
            path: 'uploads',
            maxFileSize: '10MB',
        },
    };
}

// Note: RawProvidersConfig is already exported above on line 20
