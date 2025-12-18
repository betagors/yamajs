import type { CacheAdapter } from '@yamajs/kernel';

/**
 * Cache configuration options
 */
export interface CacheConfig {
    /**
     * Default options for keys/operations
     */
    defaults?: {
        ttl?: number;
        [key: string]: unknown;
    };

    /**
     * Global key prefix (applied automatically if adapter supports namespacing)
     */
    prefix?: string;

    /**
     * Additional provider-specific config
     */
    [key: string]: unknown;
}

/**
 * Extension interface for cache plugins
 */
export interface CacheExtension {
    /**
     * Extension name
     */
    name?: string;

    /**
     * Setup hook called when extension is registered
     */
    setup?(cache: Cache): void | Promise<void>;

    /**
     * Additional methods that will be available on the Cache instance
     */
    [key: string]: any;
}

/**
 * Hook context passed to event handlers
 */
export interface HookContext {
    key?: string;
    value?: unknown;
    ttl?: number;
    result?: any;
    [key: string]: unknown;
}

/**
 * Hook handler function type
 */
export type HookHandler = (context: HookContext) => void | Promise<void>;

/**
 * Available hook events
 */
export type HookEvent =
    | 'before:get'
    | 'after:get'
    | 'before:set'
    | 'after:set'
    | 'before:del'
    | 'after:del'
    | 'before:exists'
    | 'after:exists'
    | 'before:clear'
    | 'after:clear';

/**
 * Cache - Unified, extensible cache abstraction layer
 * 
 * This class provides a stable API for cache operations while
 * allowing future enhancements through hooks and extensions without
 * breaking changes.
 * 
 * @example
 * ```js
 * // Basic usage
 * const cache = new Cache(redisAdapter);
 * await cache.set('user:123', { name: 'Alice' }, 3600);
 * const user = await cache.get('user:123');
 * 
 * // With hooks
 * cache.on('after:set', async ({ key }) => {
 *   console.log(`Cached ${key}`);
 * });
 * 
 * // With extensions
 * cache.use(compressionPlugin);
 * ```
 */
export class Cache {
    /**
     * The underlying cache adapter
     */
    readonly adapter: CacheAdapter;

    /**
     * Cache configuration
     */
    readonly config: CacheConfig;

    /**
     * Event hooks registry
     * @private
     */
    private readonly hooks: Map<HookEvent, HookHandler[]>;

    /**
     * Registered extensions
     * @private
     */
    private readonly extensions: CacheExtension[];

    /**
     * Create a new Cache instance
     * 
     * @param adapter - Cache adapter (e.g., Redis, Memcached, Memory)
     * @param config - Optional configuration
     */
    constructor(adapter: CacheAdapter, config: CacheConfig = {}) {
        this.config = config;
        this.hooks = new Map();
        this.extensions = [];

        // Apply prefix if configured
        if (config.prefix && adapter.namespace) {
            this.adapter = adapter.namespace(config.prefix);
        } else {
            this.adapter = adapter;
        }

        // Return a Proxy to enable dynamic extension methods
        return new Proxy(this, {
            get(target, prop: string | symbol) {
                // Check if property exists on Cache instance
                if (prop in target) {
                    return (target as any)[prop];
                }

                // Check extensions for additional methods
                for (const ext of target.extensions) {
                    if (typeof prop === 'string' && prop in ext && typeof ext[prop] === 'function') {
                        return ext[prop].bind(ext);
                    }
                }

                return undefined;
            },
        });
    }

    /**
     * Get a value from cache
     * 
     * @param key - Cache key
     * @returns The cached value, or null if not found
     */
    async get<T = unknown>(key: string): Promise<T | null> {
        // Run before hooks
        await this.runHooks('before:get', { key });

        // Perform get
        const result = await this.adapter.get<T>(key);

        // Run after hooks
        await this.runHooks('after:get', { key, result });

        return result;
    }

    /**
     * Set a value in cache
     * 
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttlSeconds - Time to live in seconds (optional)
     */
    async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        // Resolve TTL with defaults
        const finalTtl = ttlSeconds ?? this.config.defaults?.ttl;

        // Run before hooks
        await this.runHooks('before:set', { key, value, ttl: finalTtl });

        // Perform set
        await this.adapter.set(key, value, finalTtl);

        // Run after hooks
        await this.runHooks('after:set', { key, value, ttl: finalTtl });
    }

    /**
     * Delete a value from cache
     * 
     * @param key - Cache key to delete
     */
    async del(key: string): Promise<void> {
        // Run before hooks
        await this.runHooks('before:del', { key });

        // Perform delete
        await this.adapter.del(key);

        // Run after hooks
        await this.runHooks('after:del', { key });
    }

    /**
     * Check if a key exists in cache
     * 
     * @param key - Cache key to check
     * @returns true if key exists, false otherwise
     */
    async exists(key: string): Promise<boolean> {
        // Run before hooks
        await this.runHooks('before:exists', { key });

        // Perform exists check
        const result = await this.adapter.exists(key);

        // Run after hooks
        await this.runHooks('after:exists', { key, result });

        return result;
    }

    /**
     * Create a namespaced view of the cache
     * 
     * @param prefix - Key prefix
     * @returns New Cache instance with prefix applied
     */
    namespace(prefix: string): Cache {
        if (!this.adapter.namespace) {
            throw new Error("Underlying adapter does not support namespacing");
        }

        // Create new config inheriting safe defaults
        const newConfig = { ...this.config, prefix: undefined }; // Prefix is handled by adapter now

        return new Cache(this.adapter.namespace(prefix), newConfig);
    }

    // ============================================================
    // Extension API (non-breaking additions for future features)
    // ============================================================

    /**
     * Register an event hook
     * 
     * Hooks allow you to add behavior before/after cache operations
     * without modifying the core API.
     * 
     * @param event - Hook event name
     * @param handler - Handler function
     * @returns this for chaining
     */
    on(event: HookEvent, handler: HookHandler): this {
        if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
        }
        this.hooks.get(event)!.push(handler);
        return this;
    }

    /**
     * Register a cache extension/plugin
     * 
     * Extensions can add new methods and behavior to Cache without
     * breaking the core API.
     * 
     * @param extension - Extension object
     * @returns this for chaining
     */
    use(extension: CacheExtension): this {
        this.extensions.push(extension);

        // Call setup hook if provided
        if (extension.setup) {
            extension.setup(this);
        }

        return this;
    }

    /**
     * Run all registered hooks for an event
     * 
     * @private
     * @param event - Event name
     * @param context - Context object passed to handlers
     */
    private async runHooks(event: HookEvent, context: HookContext): Promise<void> {
        const handlers = this.hooks.get(event) || [];

        for (const handler of handlers) {
            await handler(context);
        }
    }
}
