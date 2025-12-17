import { Cache } from './cache';
import type { CacheAdapter } from '@yamajs/core';

/**
 * Cache configuration from yama.yaml
 */
export interface CacheYamlConfig {
    /**
     * Cache provider (e.g., 'redis', 'memory', 'memcached')
     */
    provider: string;

    /**
     * Key prefix (optional)
     */
    prefix?: string;

    /**
     * Default options for all operations
     */
    defaults?: {
        ttl?: number;
        [key: string]: unknown;
    };

    /**
     * Provider-specific options
     */
    options?: Record<string, unknown>;

    /**
     * Additional arbitrary config
     */
    [key: string]: unknown;
}

/**
 * Cache adapter registry
 */
const cacheAdapters = new Map<string, (config: any) => CacheAdapter>();

/**
 * Register a cache adapter factory
 *
 * @param provider - Provider name (e.g., 'redis', 'memory')
 * @param factory - Factory function that creates the adapter
 *
 * @example
 * ```ts
 * import { registerCacheProvider } from '@yamajs/cache';
 * import { createRedisAdapter } from '@yamajs/redis';
 *
 * registerCacheProvider('redis', createRedisAdapter);
 * ```
 */
export function registerCacheProvider(
    provider: string,
    factory: (config: any) => CacheAdapter
): void {
    cacheAdapters.set(provider.toLowerCase(), factory);
}

/**
 * Create cache from YAML configuration
 *
 * This function reads the cache configuration from yama.yaml and
 * creates a Cache instance with the appropriate adapter.
 *
 * @param config - Cache configuration from yama.yaml
 * @returns Cache instance
 * @throws Error if provider is not registered
 *
 * @example
 * ```yaml
 * # yama.yaml
 * cache:
 *   provider: redis
 *   prefix: my-app:
 *   defaults:
 *     ttl: 3600
 *   options:
 *     url: redis://localhost:6379
 * ```
 *
 * ```ts
 * import { createCacheFromConfig } from '@yamajs/cache';
 *
 * const cache = createCacheFromConfig(yamaConfig.cache);
 * await cache.set('key', 'value');
 * ```
 */
export function createCacheFromConfig(config: CacheYamlConfig): Cache {
    const provider = config.provider.toLowerCase();
    const factory = cacheAdapters.get(provider);

    if (!factory) {
        const available = Array.from(cacheAdapters.keys());
        throw new Error(
            `Unknown cache provider: ${config.provider}. ` +
            `Available providers: ${available.join(', ')}. ` +
            `Make sure you've registered the adapter with registerCacheProvider().`
        );
    }

    // Create the adapter with provider-specific options
    const adapterConfig = {
        ...config.options,
    };

    const adapter = factory(adapterConfig);

    // Create Cache instance with config
    const cache = new Cache(adapter, {
        prefix: config.prefix,
        defaults: config.defaults,
    });

    return cache;
}

/**
 * Get cache adapter factory for a provider
 *
 * @param provider - Provider name
 * @returns Adapter factory or undefined
 */
export function getCacheProvider(
    provider: string
): ((config: any) => CacheAdapter) | undefined {
    return cacheAdapters.get(provider.toLowerCase());
}

/**
 * Get list of registered cache providers
 *
 * @returns Array of provider names
 */
export function getRegisteredCacheProviders(): string[] {
    return Array.from(cacheAdapters.keys());
}
