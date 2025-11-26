import type { RateLimitStore, RateLimitResult } from "./types.js";
import type { RedisClient } from "./redis-store.js";

// RedisClient interface includes sorted set methods (zadd, zcard, zremrangebyscore, zrange, expire)

/**
 * Redis-optimized rate limit store using sorted sets
 * This is more efficient than the generic cache store for Redis
 * Uses atomic operations (ZADD, ZCARD) for better performance and no race conditions
 */
export class RedisOptimizedRateLimitStore implements RateLimitStore {
  private client: RedisClient;
  private keyPrefix: string;
  private failClosed: boolean;

  constructor(client: RedisClient, keyPrefix: string = "rate_limit", failClosed: boolean = false) {
    this.client = client;
    this.keyPrefix = keyPrefix;
    this.failClosed = failClosed;
  }

  /**
   * Check and increment rate limit for a key using sliding window
   * Uses Redis sorted sets to track request timestamps atomically
   */
  async checkAndIncrement(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `${this.keyPrefix}:${key}`;

    try {
      // Remove old entries outside the window (atomic operation)
      await this.client.zremrangebyscore(redisKey, 0, windowStart);

      // Get current count (atomic operation)
      const count = await this.client.zcard(redisKey);
      const allowed = count < maxRequests;

      if (allowed) {
        // Add current request timestamp (atomic operation)
        await this.client.zadd(redisKey, now, `${now}-${Math.random()}`);
      }

      // Set expiration on the key (windowMs + some buffer)
      await this.client.expire(redisKey, Math.ceil((windowMs + 1000) / 1000));

      // Get oldest timestamp to calculate reset time
      const oldestEntries = await this.client.zrange(redisKey, 0, 0);
      const oldestTimestamp = oldestEntries.length > 0
        ? parseFloat(oldestEntries[0].split("-")[0])
        : now;

      const reset = Math.ceil((oldestTimestamp + windowMs) / 1000);
      const resetAfter = Math.max(0, (oldestTimestamp + windowMs) - now);

      return {
        allowed,
        remaining: Math.max(0, maxRequests - count - (allowed ? 1 : 0)),
        limit: maxRequests,
        reset,
        resetAfter,
      };
    } catch (error) {
      // Handle cache failure based on fail-closed setting
      if (this.failClosed) {
        // Fail closed: deny the request when cache is down
        console.error(
          `Rate limit Redis check failed for key ${key} (fail-closed mode): ${error instanceof Error ? error.message : String(error)}`
        );
        return {
          allowed: false,
          remaining: 0,
          limit: maxRequests,
          reset: Math.ceil((Date.now() + windowMs) / 1000),
          resetAfter: windowMs,
        };
      } else {
        // Fail open: allow the request but log the error
        console.warn(
          `Rate limit Redis check failed for key ${key} (fail-open mode): ${error instanceof Error ? error.message : String(error)}`
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
   * Cleanup is handled automatically by Redis expiration
   */
  async cleanup(): Promise<void> {
    // Redis handles cleanup via key expiration
    // This is a no-op but implements the interface
  }
}

/**
 * Create a Redis-optimized rate limit store
 */
export function createRedisOptimizedRateLimitStore(
  client: RedisClient,
  keyPrefix?: string,
  failClosed?: boolean
): RedisOptimizedRateLimitStore {
  return new RedisOptimizedRateLimitStore(client, keyPrefix, failClosed);
}

