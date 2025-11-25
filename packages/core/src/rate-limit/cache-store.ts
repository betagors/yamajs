import type { RateLimitStore, RateLimitResult } from "./types";
import type { CacheAdapter } from "../infrastructure/cache";

/**
 * Cache-based rate limit store using sliding window algorithm
 * Works with any CacheAdapter implementation (Redis, Memcached, etc.)
 */
export class CacheRateLimitStore implements RateLimitStore {
  private cache: CacheAdapter;
  private keyPrefix: string;

  constructor(cache: CacheAdapter, keyPrefix: string = "rate_limit") {
    this.cache = cache;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Check and increment rate limit for a key using sliding window
   * Stores request timestamps in cache
   */
  async checkAndIncrement(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
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
      // If cache fails, allow the request but log the error
      // This is a graceful degradation strategy
      console.warn(
        `Rate limit cache check failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`
      );
      
      // Return allowed=true as fallback to avoid blocking requests when cache is down
      return {
        allowed: true,
        remaining: maxRequests - 1,
        limit: maxRequests,
        reset: Math.ceil((now + windowMs) / 1000),
        resetAfter: windowMs,
      };
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
  keyPrefix?: string
): CacheRateLimitStore {
  return new CacheRateLimitStore(cache, keyPrefix);
}

