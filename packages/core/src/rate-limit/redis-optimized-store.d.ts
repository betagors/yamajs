import type { RateLimitStore, RateLimitResult } from "./types.js";
import type { RedisClient } from "./redis-store.js";
/**
 * Redis-optimized rate limit store using sorted sets
 * This is more efficient than the generic cache store for Redis
 * Uses atomic operations (ZADD, ZCARD) for better performance and no race conditions
 */
export declare class RedisOptimizedRateLimitStore implements RateLimitStore {
    private client;
    private keyPrefix;
    private failClosed;
    constructor(client: RedisClient, keyPrefix?: string, failClosed?: boolean);
    /**
     * Check and increment rate limit for a key using sliding window
     * Uses Redis sorted sets to track request timestamps atomically
     */
    checkAndIncrement(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
    /**
     * Cleanup is handled automatically by Redis expiration
     */
    cleanup(): Promise<void>;
}
/**
 * Create a Redis-optimized rate limit store
 */
export declare function createRedisOptimizedRateLimitStore(client: RedisClient, keyPrefix?: string, failClosed?: boolean): RedisOptimizedRateLimitStore;
