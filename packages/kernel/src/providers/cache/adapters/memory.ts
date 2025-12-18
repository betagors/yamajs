/**
 * Cache Provider - Memory Adapter
 * 
 * In-memory LRU cache with TTL support.
 * Zero external dependencies.
 * 
 * Features:
 * - LRU eviction when max size reached
 * - TTL (time-to-live) with automatic expiration
 * - Namespaced caches
 * - Cache-aside pattern (getOrSet)
 * - Bulk operations (mget, mset, mdel)
 */

import type {
    Provider,
    ProviderContext,
    CacheProviderConfig,
    CacheAPI,
} from '../../types.js';
import { registerAdapter } from '../../registry.js';

// ============================================================================
// TTL Parsing
// ============================================================================

/**
 * Parse TTL string to milliseconds
 * Supports: 100 (ms), 5s, 5m, 5h, 5d
 */
export function parseTTL(ttl: string | number): number {
    if (typeof ttl === 'number') {
        return ttl; // Already in ms
    }

    const match = ttl.match(/^(\d+)(ms|s|m|h|d)?$/);
    if (!match) {
        throw new Error(`Invalid TTL format: ${ttl}. Use: 100, 5s, 5m, 5h, 5d`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2] || 'ms';

    const multipliers: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
}

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry<T> {
    value: T;
    expiresAt: number | null; // null = no expiration
    createdAt: number;
    accessedAt: number;
}

// ============================================================================
// LRU Memory Cache
// ============================================================================

class MemoryCache implements CacheAPI {
    private cache = new Map<string, CacheEntry<unknown>>();
    private maxSize: number;
    private defaultTTL: number | null;
    private prefix: string;

    constructor(options: {
        maxSize: number;
        defaultTTL: number | null;
        prefix?: string;
    }) {
        this.maxSize = options.maxSize;
        this.defaultTTL = options.defaultTTL;
        this.prefix = options.prefix || '';
    }

    private getFullKey(key: string): string {
        return this.prefix + key;
    }

    private isExpired(entry: CacheEntry<unknown>): boolean {
        if (entry.expiresAt === null) return false;
        return Date.now() > entry.expiresAt;
    }

    private evictIfNeeded(): void {
        if (this.cache.size < this.maxSize) return;

        // Find LRU entry (oldest access time)
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.accessedAt < oldestTime) {
                oldestTime = entry.accessedAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    private cleanupExpired(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt !== null && now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    async get<T>(key: string): Promise<T | null> {
        const fullKey = this.getFullKey(key);
        const entry = this.cache.get(fullKey);

        if (!entry) return null;

        // Check expiration
        if (this.isExpired(entry)) {
            this.cache.delete(fullKey);
            return null;
        }

        // Update access time for LRU
        entry.accessedAt = Date.now();

        return entry.value as T;
    }

    async set<T>(key: string, value: T, ttl?: string | number): Promise<void> {
        const fullKey = this.getFullKey(key);
        const now = Date.now();

        // Calculate expiration
        let expiresAt: number | null = null;
        if (ttl !== undefined) {
            expiresAt = now + parseTTL(ttl);
        } else if (this.defaultTTL !== null) {
            expiresAt = now + this.defaultTTL;
        }

        // Evict if at capacity
        if (!this.cache.has(fullKey)) {
            this.evictIfNeeded();
        }

        // Store entry
        this.cache.set(fullKey, {
            value,
            expiresAt,
            createdAt: now,
            accessedAt: now,
        });
    }

    async del(key: string): Promise<void> {
        const fullKey = this.getFullKey(key);
        this.cache.delete(fullKey);
    }

    async exists(key: string): Promise<boolean> {
        const fullKey = this.getFullKey(key);
        const entry = this.cache.get(fullKey);

        if (!entry) return false;

        if (this.isExpired(entry)) {
            this.cache.delete(fullKey);
            return false;
        }

        return true;
    }

    async mget<T>(keys: string[]): Promise<(T | null)[]> {
        return Promise.all(keys.map(key => this.get<T>(key)));
    }

    async mset<T>(entries: Record<string, T>, ttl?: string | number): Promise<void> {
        for (const [key, value] of Object.entries(entries)) {
            await this.set(key, value, ttl);
        }
    }

    async mdel(keys: string[]): Promise<void> {
        for (const key of keys) {
            await this.del(key);
        }
    }

    async clear(): Promise<void> {
        if (this.prefix) {
            // Only clear keys with this prefix
            for (const key of this.cache.keys()) {
                if (key.startsWith(this.prefix)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    namespace(prefix: string): CacheAPI {
        return new MemoryCache({
            maxSize: this.maxSize,
            defaultTTL: this.defaultTTL,
            prefix: this.prefix + prefix + ':',
        });
    }

    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttl?: string | number
    ): Promise<T> {
        const existing = await this.get<T>(key);
        if (existing !== null) {
            return existing;
        }

        const value = await factory();
        await this.set(key, value, ttl);
        return value;
    }

    // Internal methods for provider
    getStats(): { size: number; maxSize: number } {
        // Clean up expired entries before reporting
        this.cleanupExpired();
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}

// ============================================================================
// Memory Cache Provider
// ============================================================================

class MemoryCacheProvider implements Provider<CacheProviderConfig, CacheAPI> {
    readonly type = 'cache' as const;
    readonly adapter = 'memory';
    readonly version = '1.0.0';

    private cache: MemoryCache | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;

    async init(config: CacheProviderConfig, context: ProviderContext): Promise<CacheAPI> {
        // Parse configuration
        const maxSize = config.maxSize ?? 1000;
        const defaultTTL = config.ttl ? parseTTL(config.ttl) : null;

        // Create cache
        this.cache = new MemoryCache({
            maxSize,
            defaultTTL,
        });

        // Set up periodic cleanup of expired entries (every 60 seconds)
        this.cleanupInterval = setInterval(() => {
            if (this.cache) {
                // Trigger cleanup by getting stats
                (this.cache as any).cleanupExpired?.();
            }
        }, 60_000);

        // Don't block shutdown
        this.cleanupInterval.unref?.();

        context.log.info('Memory cache provider initialized', {
            maxSize,
            defaultTTL: defaultTTL ? `${defaultTTL}ms` : 'none',
        });

        return this.cache;
    }

    getAPI(): CacheAPI {
        if (!this.cache) {
            throw new Error('Cache provider not initialized. Call init() first.');
        }
        return this.cache;
    }

    isInitialized(): boolean {
        return this.cache !== null;
    }

    async healthCheck() {
        if (!this.cache) {
            return { healthy: false, error: 'Not initialized' };
        }

        const stats = (this.cache as MemoryCache).getStats();
        return {
            healthy: true,
            details: {
                size: stats.size,
                maxSize: stats.maxSize,
                usage: `${Math.round((stats.size / stats.maxSize) * 100)}%`,
            },
        };
    }

    async shutdown(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.cache) {
            await this.cache.clear();
            this.cache = null;
        }
    }
}

// ============================================================================
// Register Adapter
// ============================================================================

registerAdapter('cache', 'memory', () => new MemoryCacheProvider());

// ============================================================================
// Exports
// ============================================================================

export { MemoryCacheProvider, MemoryCache };
// Note: parseTTL is already exported above at line 31

