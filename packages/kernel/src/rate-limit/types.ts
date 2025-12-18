/**
 * Rate limiting key strategy - how to identify clients
 */
export type RateLimitKeyStrategy = "ip" | "user" | "both";

/**
 * Rate limiting storage backend type
 */
export type RateLimitStoreType = "memory" | "cache";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * How to identify clients for rate limiting
   * - "ip": Rate limit by IP address
   * - "user": Rate limit by authenticated user ID
   * - "both": Rate limit by both IP and user (stricter)
   */
  keyBy?: RateLimitKeyStrategy;

  /**
   * Storage backend to use
   * - "memory": In-memory store (default, single-instance only)
   * - "cache": Use cache adapter from plugin (works with any cache implementation like Redis, Memcached, etc.)
   */
  store?: RateLimitStoreType;

  /**
   * Behavior when cache/store is unavailable
   * - "fail-open" (default): Allow requests when cache fails (graceful degradation)
   * - "fail-closed": Deny requests when cache fails (more secure, but can cause outages)
   */
  onFailure?: "fail-open" | "fail-closed";
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Number of requests remaining in the current window
   */
  remaining: number;

  /**
   * Total limit for the window
   */
  limit: number;

  /**
   * Unix timestamp (in seconds) when the rate limit resets
   */
  reset: number;

  /**
   * Time until reset in milliseconds
   */
  resetAfter: number;
}

/**
 * Rate limit store interface
 * Implementations provide storage for rate limit data
 */
export interface RateLimitStore {
  /**
   * Check and increment rate limit for a key
   * @param key - Unique identifier for the client (IP, user ID, or combination)
   * @param maxRequests - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns Rate limit result
   */
  checkAndIncrement(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult>;

  /**
   * Cleanup expired entries (optional, for memory management)
   */
  cleanup?(): Promise<void> | void;
}

