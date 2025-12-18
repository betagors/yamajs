import type { RateLimitStore, RateLimitResult, RateLimitConfig } from "./types.js";
import type { CacheAdapter } from "../infrastructure/cache.js";
import { createRedisOptimizedRateLimitStore, type RedisOptimizedRateLimitStore } from "./redis-optimized-store.js";
import type { RedisClient } from "./redis-store.js";

/**
 * Check if a cache adapter is a Redis adapter
 * @internal
 */
function isRedisAdapter(cache: CacheAdapter): cache is CacheAdapter & { getRedisClient(): RedisClient } {
  return typeof (cache as any).getRedisClient === "function";
}

/**
 * Cache-based rate limit store using sliding window algorithm
 * Works with any CacheAdapter implementation (Redis, Memcached, etc.)
 * 
 * Performance Note: 
 * - For Redis adapters, automatically uses optimized sorted sets (ZADD, ZCARD) for atomic operations
 * - For other adapters, uses GET + SET operations (2 round trips, potential race conditions)
 */
export class CacheRateLimitStore implements RateLimitStore {
  private cache: CacheAdapter;
  private keyPrefix: string;
  private failClosed: boolean;
  private optimizedStore?: RedisOptimizedRateLimitStore;

  constructor(cache: CacheAdapter, keyPrefix: string = "rate_limit", failClosed: boolean = false) {
    this.cache = cache;
    this.keyPrefix = keyPrefix;
    this.failClosed = failClosed;

    // If this is a Redis adapter, use optimized store
    if (isRedisAdapter(cache)) {
      try {
        const redisClient = cache.getRedisClient();
        this.optimizedStore = createRedisOptimizedRateLimitStore(
          redisClient,
          keyPrefix,
          failClosed
        );
      } catch {
        // If getting client fails, fall back to generic cache store
        this.optimizedStore = undefined;
      }
    }
  }

  /**
   * Check and increment rate limit for a key using sliding window
   * Stores request timestamps in cache
   * Uses optimized Redis sorted sets if Redis adapter is available
   */
  async checkAndIncrement(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    // Use optimized store if available (Redis with sorted sets)
    if (this.optimizedStore) {
      return await this.optimizedStore.checkAndIncrement(key, maxRequests, windowMs);
    }

    // Fall back to generic cache store (GET + SET, works with any cache)
    const now = Date.now();
    const windowStart = now - windowMs;
    const cacheKey = `${this.keyPrefix}:${key}`;

    try {
      // Get existing timestamps from cache
      const cached = await this.cache.get<number[]>(cacheKey);
      let timestamps: number[] = cached || [];

      // Remove timestamps outside the current window
      timestamps = timestamps.filter((ts) => ts > windowStart);

      // Check if limit exceeded
      const currentCount = timestamps.length;
      const allowed = currentCount < maxRequests;

      if (allowed) {
        // Add current request timestamp
        timestamps.push(now);
      }

      // Calculate TTL: windowMs + small buffer to ensure we don't lose data
      const ttlSeconds = Math.ceil((windowMs + 1000) / 1000);

      // Store updated timestamps back to cache
      await this.cache.set(cacheKey, timestamps, ttlSeconds);

      // Calculate reset time (when the oldest request in window expires)
      const oldestTimestamp = timestamps.length > 0 
        ? Math.min(...timestamps)
        : now;
      const reset = Math.ceil((oldestTimestamp + windowMs) / 1000); // Convert to seconds
      const resetAfter = Math.max(0, (oldestTimestamp + windowMs) - now);

      return {
        allowed,
        remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
        limit: maxRequests,
        reset,
        resetAfter,
      };
    } catch (error) {
      // Handle cache failure based on fail-closed setting
      if (this.failClosed) {
        // Fail closed: deny the request when cache is down
        console.error(
          `Rate limit cache check failed for key ${key} (fail-closed mode): ${error instanceof Error ? error.message : String(error)}`
        );
        return {
          allowed: false,
          remaining: 0,
          limit: maxRequests,
          reset: Math.ceil((now + windowMs) / 1000),
          resetAfter: windowMs,
        };
      } else {
        // Fail open: allow the request but log the error (graceful degradation)
        console.warn(
          `Rate limit cache check failed for key ${key} (fail-open mode): ${error instanceof Error ? error.message : String(error)}`
        );
        return {
          allowed: true,
          remaining: maxRequests - 1,
          limit: maxRequests,
          reset: Math.ceil((now + windowMs) / 1000),
          resetAfter: windowMs,
        };
      }
    }
  }

  /**
   * Cleanup is handled automatically by cache TTL
   */
  async cleanup(): Promise<void> {
    // Cache handles cleanup via TTL, so this is a no-op
    // But we implement it for interface compliance
  }
}

/**
 * Create a cache-based rate limit store
 */
export function createCacheRateLimitStore(
  cache: CacheAdapter,
  keyPrefix?: string,
  failClosed?: boolean
): CacheRateLimitStore {
  return new CacheRateLimitStore(cache, keyPrefix, failClosed);
}

