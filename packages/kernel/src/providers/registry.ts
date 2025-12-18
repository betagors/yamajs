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
    ProviderLogger,
    PROVIDER_INIT_ORDER,
    HealthCheckResult,
} from './types.js';

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

/**
 * Default adapter for each provider type
 */
const DEFAULT_ADAPTERS: Record<ProviderType, string> = {
    config: 'env',
    logging: 'console',
    database: 'pglite',
    cache: 'memory',
    email: 'smtp',
    auth: 'jwt-password',
    storage: 'local',
};

/**
 * Provider initialization order
 */
const INIT_ORDER: readonly ProviderType[] = [
    'config',
    'logging',
    'database',
    'cache',
    'email',
    'auth',
    'storage',
];

/**
 * Initialize a single provider
 */
async function initializeProvider(
    providerType: ProviderType,
    config: Record<string, unknown> | undefined,
    context: ProviderContext
): Promise<void> {
    // Get adapter name from config or use default
    const adapterName = (config?.adapter as string) || DEFAULT_ADAPTERS[providerType];

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
    const nodeEnv = process.env.NODE_ENV || 'development';
    const env = nodeEnv === 'production' ? 'production'
        : nodeEnv === 'test' ? 'test'
            : 'development';

    // Create bootstrap logger (before logging provider is initialized)
    const bootstrapLogger = createBootstrapLogger(env !== 'production');

    // Create initial context
    const context: ProviderContext = {
        projectDir,
        env,
        isDev: env === 'development',
        isProd: env === 'production',
        log: bootstrapLogger,
        getConfig: <T>(key: string, defaultValue?: T) => {
            // Before config provider is ready, read from process.env
            const value = process.env[key];
            return (value !== undefined ? value : defaultValue) as T | undefined;
        },
        getRequiredConfig: <T>(key: string) => {
            const value = process.env[key];
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

    bootstrapLogger.info('Starting provider initialization', {
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

            // After logging provider is initialized, update context.log
            if (providerType === 'logging') {
                const loggerAPI = providerAPIs.get('logging') as import('./types.js').LoggerAPI;
                context.log = loggerAPI;
            }
        } catch (error) {
            bootstrapLogger.error(`Failed to initialize ${providerType} provider`, {
                error: error instanceof Error ? error.message : String(error),
            });

            // Shutdown already initialized providers
            await shutdownProviders();

            throw error;
        }
    }

    context.log.info('All providers initialized successfully');

    // Return provider APIs
    return {
        config: providerAPIs.get('config') as import('./types.js').ConfigAPI,
        log: providerAPIs.get('logging') as import('./types.js').LoggerAPI,
        db: providerAPIs.get('database') as import('./types.js').DatabaseAPI,
        cache: providerAPIs.get('cache') as import('./types.js').CacheAPI,
        email: providerAPIs.get('email') as import('./types.js').EmailAPI,
        auth: providerAPIs.get('auth') as import('./types.js').AuthAPI,
        storage: providerAPIs.get('storage') as import('./types.js').StorageAPI,
    };
}

/**
 * Shutdown all providers in reverse order
 */
export async function shutdownProviders(): Promise<void> {
    const logger = providerAPIs.get('logging') as ProviderLogger | undefined;
    const log = logger ?? createBootstrapLogger(true);

    log.info('Shutting down providers...');

    // Shutdown in reverse order
    const reverseOrder = [...INIT_ORDER].reverse();

    for (const providerType of reverseOrder) {
        const provider = initializedProviders.get(providerType);
        if (provider?.shutdown) {
            try {
                log.debug(`Shutting down ${providerType} provider`);
                await provider.shutdown();
                log.info(`${providerType} provider shut down`);
            } catch (error) {
                log.error(`Error shutting down ${providerType} provider`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }

    // Clear registries
    initializedProviders.clear();
    providerAPIs.clear();

    log.info('All providers shut down');
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
// Bootstrap Logger
// ============================================================================

/**
 * Create a simple bootstrap logger for use before logging provider is ready
 */
function createBootstrapLogger(colors: boolean): ProviderLogger {
    const formatMeta = (meta?: Record<string, unknown>): string => {
        if (!meta || Object.keys(meta).length === 0) return '';
        return ' ' + JSON.stringify(meta);
    };

    const timestamp = (): string => {
        return new Date().toISOString();
    };

    const colorize = (level: string, message: string): string => {
        if (!colors) return message;
        const codes: Record<string, string> = {
            debug: '\x1b[90m', // gray
            info: '\x1b[36m',  // cyan
            warn: '\x1b[33m',  // yellow
            error: '\x1b[31m', // red
        };
        const reset = '\x1b[0m';
        return `${codes[level] || ''}${message}${reset}`;
    };

    const log = (level: string, message: string, meta?: Record<string, unknown>): void => {
        const output = `[${timestamp()}] ${level.toUpperCase().padEnd(5)} ${message}${formatMeta(meta)}`;
        if (level === 'error') {
            console.error(colorize(level, output));
        } else if (level === 'warn') {
            console.warn(colorize(level, output));
        } else {
            console.log(colorize(level, output));
        }
    };

    const logger: ProviderLogger = {
        debug: (message, meta) => log('debug', message, meta),
        info: (message, meta) => log('info', message, meta),
        warn: (message, meta) => log('warn', message, meta),
        error: (message, meta) => log('error', message, meta),
        child: (bindings) => {
            // Create child logger that includes bindings
            const childLog = (level: string, message: string, meta?: Record<string, unknown>): void => {
                log(level, message, { ...bindings, ...meta });
            };
            return {
                debug: (message, meta) => childLog('debug', message, meta),
                info: (message, meta) => childLog('info', message, meta),
                warn: (message, meta) => childLog('warn', message, meta),
                error: (message, meta) => childLog('error', message, meta),
                child: (newBindings) => logger.child({ ...bindings, ...newBindings }),
            };
        },
    };

    return logger;
}

// ============================================================================
// Exports
// ============================================================================

export {
    initializedProviders,
    providerAPIs,
    INIT_ORDER,
    DEFAULT_ADAPTERS,
};
