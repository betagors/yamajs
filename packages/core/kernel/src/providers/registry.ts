/**
 * Yama v1.0 Provider System - Provider Registry
 * 
 * Manages provider registration, initialization, and lifecycle.
 * Handles provider dependencies and initialization order.
 */

import type {
    Provider,
    ProviderType,
    ProviderContext,
    ProvidersConfig,
    ProviderAPIs,
    HealthCheckResult,
} from './types.js';
import { PROVIDER_INIT_ORDER } from './types.js';
import { getRuntime } from '../platform/index.js';
import { Logger, createConsoleTransport } from '@yamajs/logging';

// ============================================================================
// Adapter Registry
// ============================================================================

/**
 * Adapter factory function type
 */
export type AdapterFactory<TConfig = unknown, TAPI = unknown> = () => Provider<TConfig, TAPI>;

/**
 * Registry of adapters for each provider type
 */
const adapterRegistry = new Map<ProviderType, Map<string, AdapterFactory>>();

/**
 * Register an adapter for a provider type
 */
export function registerAdapter<TConfig = unknown, TAPI = unknown>(
    providerType: ProviderType,
    adapterName: string,
    factory: AdapterFactory<TConfig, TAPI>
): void {
    let adapters = adapterRegistry.get(providerType);
    if (!adapters) {
        adapters = new Map();
        adapterRegistry.set(providerType, adapters);
    }
    adapters.set(adapterName.toLowerCase(), factory as AdapterFactory);
}

/**
 * Get an adapter factory
 */
export function getAdapterFactory(
    providerType: ProviderType,
    adapterName: string
): AdapterFactory | null {
    const adapters = adapterRegistry.get(providerType);
    if (!adapters) return null;
    return adapters.get(adapterName.toLowerCase()) ?? null;
}

/**
 * List available adapters for a provider type
 */
export function listAdapters(providerType: ProviderType): string[] {
    const adapters = adapterRegistry.get(providerType);
    if (!adapters) return [];
    return Array.from(adapters.keys());
}

// ============================================================================
// Provider Registry
// ============================================================================

/**
 * Initialized providers storage
 */
const initializedProviders = new Map<ProviderType, Provider>();

/**
 * Provider APIs storage
 */
const providerAPIs = new Map<ProviderType, unknown>();
let systemLogger: Logger | null = null;


/**
 * Provider initialization order (excluding core services like logging)
 */
const INIT_ORDER: readonly ProviderType[] = PROVIDER_INIT_ORDER;

/**
 * Initialize a single provider
 */
async function initializeProvider(
    providerType: ProviderType,
    config: Record<string, unknown> | undefined,
    context: ProviderContext
): Promise<void> {
    // Get adapter name from config
    const adapterName = (config?.adapter as string);

    if (!adapterName) {
        throw new Error(
            `No adapter configured for provider '${providerType}'. ` +
            `Please specify an adapter in the configuration (e.g. { adapter: 'memory' }).`
        );
    }

    // Get adapter factory
    const factory = getAdapterFactory(providerType, adapterName);
    if (!factory) {
        const available = listAdapters(providerType);
        throw new Error(
            `Unknown adapter '${adapterName}' for provider '${providerType}'. ` +
            `Available adapters: ${available.length > 0 ? available.join(', ') : 'none registered'}`
        );
    }

    // Create provider instance
    const provider = factory();

    // Initialize provider
    context.log.debug(`Initializing ${providerType} provider with ${adapterName} adapter`);
    const api = await provider.init(config ?? {}, context);

    // Store provider and API
    initializedProviders.set(providerType, provider);
    providerAPIs.set(providerType, api);

    context.log.info(`${providerType} provider initialized`, { adapter: adapterName });
}

/**
 * Initialize all providers in correct order
 */
export async function initializeProviders(
    config: ProvidersConfig,
    projectDir: string
): Promise<ProviderAPIs> {
    // Determine environment
    const nodeEnv = getRuntime().env.get('NODE_ENV') || 'development';
    const env = nodeEnv === 'production' ? 'production'
        : nodeEnv === 'test' ? 'test'
            : 'development';

    systemLogger = new Logger({
        transports: [createConsoleTransport({ format: env === 'development' ? 'pretty' : 'json' })]
    });

    const logger = systemLogger;

    // Create initial context
    const context: ProviderContext = {
        projectDir,
        env,
        isDev: env === 'development',
        isProd: env === 'production',
        log: logger,
        getConfig: <T>(key: string, defaultValue?: T) => {
            const value = getRuntime().env.get(key);
            return (value !== undefined ? value : defaultValue) as T | undefined;
        },
        getRequiredConfig: <T>(key: string) => {
            const value = getRuntime().env.get(key);
            if (value === undefined) {
                throw new Error(`Required config '${key}' is not set`);
            }
            return value as unknown as T;
        },
        getProvider: <T>(type: ProviderType) => {
            return (providerAPIs.get(type) as T) ?? null;
        },
        isProviderInitialized: (type: ProviderType) => {
            return initializedProviders.has(type);
        },
    };

    logger.info('Starting provider initialization', {
        projectDir,
        env,
        providers: INIT_ORDER,
    });

    // Initialize providers in order
    for (const providerType of INIT_ORDER) {
        const providerConfig = config[providerType] as Record<string, unknown> | undefined;

        try {
            await initializeProvider(providerType, providerConfig, context);

            // After config provider is initialized, update context.getConfig
            if (providerType === 'config') {
                const configAPI = providerAPIs.get('config') as import('./types.js').ConfigAPI;
                context.getConfig = configAPI.get.bind(configAPI);
                context.getRequiredConfig = configAPI.getRequired.bind(configAPI);
            }
        } catch (error) {
            logger.error(`Failed to initialize ${providerType} provider`, error);

            // Shutdown already initialized providers
            await shutdownProviders();

            throw error;
        }
    }

    logger.info('All providers initialized successfully');

    // Return provider APIs
    const apis: any = {};
    for (const [type, api] of providerAPIs) {
        apis[type] = api;
    }

    return apis as ProviderAPIs;
}

/**
 * Shutdown all providers in reverse order
 */
export async function shutdownProviders(): Promise<void> {
    const logger = getSystemLogger();
    logger.info('Shutting down providers...');
    const reverseOrder = [...INIT_ORDER].reverse();

    for (const providerType of reverseOrder) {
        const provider = initializedProviders.get(providerType);
        if (provider?.shutdown) {
            try {
                logger.debug(`Shutting down ${providerType} provider`);
                await provider.shutdown();
                logger.info(`${providerType} provider shut down`);
            } catch (error) {
                logger.error(`Error shutting down ${providerType} provider`, error);
            }
        }
    }

    // Clear registries
    initializedProviders.clear();
    providerAPIs.clear();

    logger.info('All providers shut down');
}

/**
 * Get a provider API
 */
export function getProviderAPI<T>(type: ProviderType): T | null {
    return (providerAPIs.get(type) as T) ?? null;
}

/**
 * Check if a provider is initialized
 */
export function isProviderInitialized(type: ProviderType): boolean {
    return initializedProviders.has(type);
}

/**
 * Get health status of all providers
 */
export async function getProvidersHealth(): Promise<Record<ProviderType, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};

    for (const [type, provider] of initializedProviders) {
        if (provider.healthCheck) {
            try {
                results[type] = await provider.healthCheck();
            } catch (error) {
                results[type] = {
                    healthy: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        } else {
            // No health check = assume healthy
            results[type] = { healthy: true };
        }
    }

    return results as Record<ProviderType, HealthCheckResult>;
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Get the core system logger
 */
export function getSystemLogger(): Logger {
    if (!systemLogger) {
        // Fallback to a basic console logger if not initialized
        systemLogger = new Logger({
            transports: [createConsoleTransport()]
        });
    }
    return systemLogger;
}

export {
    initializedProviders,
    providerAPIs,
    INIT_ORDER,
};
