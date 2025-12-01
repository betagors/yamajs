import type { RateLimitStore, RateLimitResult } from "./types.js";
import type { CacheAdapter } from "../infrastructure/cache.js";
/**
 * Cache-based rate limit store using sliding window algorithm
 * Works with any CacheAdapter implementation (Redis, Memcached, etc.)
 *
 * Performance Note:
 * - For Redis adapters, automatically uses optimized sorted sets (ZADD, ZCARD) for atomic operations
 * - For other adapters, uses GET + SET operations (2 round trips, potential race conditions)
 */
export declare class CacheRateLimitStore implements RateLimitStore {
    private cache;
    private keyPrefix;
    private failClosed;
    private optimizedStore?;
    constructor(cache: CacheAdapter, keyPrefix?: string, failClosed?: boolean);
    /**
     * Check and increment rate limit for a key using sliding window
     * Stores request timestamps in cache
     * Uses optimized Redis sorted sets if Redis adapter is available
     */
    checkAndIncrement(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
    /**
     * Cleanup is handled automatically by cache TTL
     */
    cleanup(): Promise<void>;
}
/**
 * Create a cache-based rate limit store
 */
export declare function createCacheRateLimitStore(cache: CacheAdapter, keyPrefix?: string, failClosed?: boolean): CacheRateLimitStore;
