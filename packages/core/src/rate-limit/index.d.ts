import type { RateLimitConfig, RateLimitStore, RateLimitResult } from "./types.js";
import type { HttpRequest } from "../infrastructure/server.js";
import type { AuthContext } from "../schemas.js";
import type { CacheAdapter } from "../infrastructure/cache.js";
/**
 * Rate limiter instance
 */
export interface RateLimiter {
    /**
     * Check rate limit for a request
     * @param request - HTTP request object
     * @param authContext - Optional authentication context
     * @param config - Rate limit configuration (merged with defaults)
     * @returns Rate limit result
     */
    check(request: HttpRequest, authContext: AuthContext | undefined, config: RateLimitConfig): Promise<RateLimitResult>;
}
/**
 * Create a rate limiter with the specified store
 */
export declare function createRateLimiter(store: RateLimitStore): RateLimiter;
/**
 * Create a rate limiter from configuration
 * Automatically selects the appropriate store (memory or cache)
 *
 * @param config - Rate limit configuration
 * @param cacheAdapter - Optional cache adapter from cache plugin (works with any cache implementation like Redis, Memcached, etc.)
 */
export declare function createRateLimiterFromConfig(config: RateLimitConfig, cacheAdapter?: CacheAdapter): Promise<RateLimiter>;
/**
 * Format rate limit headers according to RFC 6585
 */
export declare function formatRateLimitHeaders(result: RateLimitResult): Record<string, string>;
export type { RateLimitConfig, RateLimitResult, RateLimitStore, RateLimitKeyStrategy } from "./types.js";
export { createMemoryRateLimitStore, MemoryRateLimitStore } from "./memory-store.js";
export { createCacheRateLimitStore, CacheRateLimitStore } from "./cache-store.js";
export { createRedisOptimizedRateLimitStore, RedisOptimizedRateLimitStore } from "./redis-optimized-store.js";
