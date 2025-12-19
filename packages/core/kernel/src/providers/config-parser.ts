/**
 * Provider Configuration Parser
 * 
 * Parses the `providers:` block from yama.yaml and initializes all providers.
 * This is the entry point for integrating the provider system with the CLI.
 */

import type { ProvidersConfig, ProviderAPIs } from './types.js';
import { initializeProviders, shutdownProviders, getProvidersHealth } from './registry.js';
import { resolveEnvVars } from '../env.js';

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

    // Use kernel's environment variable resolver
    // Note: resolveEnvVars uses the runtime environment
    return resolveEnvVars(rawConfig) as ProvidersConfig;
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
    envVars: Record<string, string> = {}
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


// Note: RawProvidersConfig is already exported above on line 20
