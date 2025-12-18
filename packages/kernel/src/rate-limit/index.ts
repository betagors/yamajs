import type {
  RateLimitConfig,
  RateLimitStore,
  RateLimitKeyStrategy,
  RateLimitResult,
} from "./types.js";
import { createMemoryRateLimitStore, MemoryRateLimitStore } from "./memory-store.js";
import { createCacheRateLimitStore, CacheRateLimitStore } from "./cache-store.js";
import { createRedisOptimizedRateLimitStore, RedisOptimizedRateLimitStore } from "./redis-optimized-store.js";
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
  check(
    request: HttpRequest,
    authContext: AuthContext | undefined,
    config: RateLimitConfig
  ): Promise<RateLimitResult>;
}

/**
 * Create a rate limiter with the specified store
 */
export function createRateLimiter(store: RateLimitStore): RateLimiter {
  return {
    async check(
      request: HttpRequest,
      authContext: AuthContext | undefined,
      config: RateLimitConfig
    ): Promise<RateLimitResult> {
      const key = generateRateLimitKey(request, authContext, config.keyBy || "ip");
      return await store.checkAndIncrement(key, config.maxRequests, config.windowMs);
    },
  };
}

/**
 * Create a rate limiter from configuration
 * Automatically selects the appropriate store (memory or cache)
 * 
 * @param config - Rate limit configuration
 * @param cacheAdapter - Optional cache adapter from cache plugin (works with any cache implementation like Redis, Memcached, etc.)
 */
export async function createRateLimiterFromConfig(
  config: RateLimitConfig,
  cacheAdapter?: CacheAdapter
): Promise<RateLimiter> {
  const storeType = config.store || "memory";

  let store: RateLimitStore;

  if (storeType === "cache") {
    // Use cache adapter (works with Redis, Memcached, or any cache implementation)
    if (cacheAdapter) {
      const failClosed = config.onFailure === "fail-closed";
      store = createCacheRateLimitStore(cacheAdapter, undefined, failClosed);
    } else {
      console.warn(
        "⚠️  Rate limit store is set to 'cache' but no cache adapter is available. Falling back to memory."
      );
      store = createMemoryRateLimitStore();
    }
  } else {
    // Default to memory store
    store = createMemoryRateLimitStore();
  }

  return createRateLimiter(store);
}

/**
 * Generate a rate limit key based on the strategy
 */
function generateRateLimitKey(
  request: HttpRequest,
  authContext: AuthContext | undefined,
  keyBy: RateLimitKeyStrategy
): string {
  const ip = extractIpAddress(request);
  const parts: string[] = [];

  if (keyBy === "ip" || keyBy === "both") {
    parts.push(`ip:${ip}`);
  }

  if (keyBy === "user" || keyBy === "both") {
    if (authContext?.authenticated && authContext.user?.id) {
      parts.push(`user:${authContext.user.id}`);
    } else if (keyBy === "user") {
      // If user-based but not authenticated, fall back to IP
      parts.push(`ip:${ip}`);
    }
  }

  // If no parts (shouldn't happen), use IP as fallback
  if (parts.length === 0) {
    parts.push(`ip:${ip}`);
  }

  return parts.join(":");
}

/**
 * Extract IP address from request
 * Handles various proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 */
function extractIpAddress(request: HttpRequest): string {
  const headers = request.headers || {};

  // Check X-Forwarded-For (may contain multiple IPs, take the first)
  const forwardedFor = headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    return ips[0] || "unknown";
  }

  // Check X-Real-IP
  const realIp = headers["x-real-ip"];
  if (realIp) {
    return realIp;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIp = headers["cf-connecting-ip"];
  if (cfIp) {
    return cfIp;
  }

  // Fallback to extracting from original request if available
  const original = request._original as any;
  if (original?.ip) {
    return original.ip;
  }

  if (original?.socket?.remoteAddress) {
    return original.socket.remoteAddress;
  }

  // Last resort
  return "unknown";
}

/**
 * Format rate limit headers according to RFC 6585
 */
export function formatRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    "Retry-After": String(Math.ceil(result.resetAfter / 1000)), // In seconds
  };
}

// Export types and stores
export type { RateLimitConfig, RateLimitResult, RateLimitStore, RateLimitKeyStrategy } from "./types.js";
export { createMemoryRateLimitStore, MemoryRateLimitStore } from "./memory-store.js";
export { createCacheRateLimitStore, CacheRateLimitStore } from "./cache-store.js";
export { createRedisOptimizedRateLimitStore, RedisOptimizedRateLimitStore } from "./redis-optimized-store.js";

