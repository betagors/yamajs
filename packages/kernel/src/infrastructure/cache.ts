/**
 * Cache adapter interface - unified API for all cache implementations
 * 
 * This interface provides a consistent API for cache operations regardless
 * of the underlying implementation (Redis, Memcached, in-memory, etc.)
 */
export interface CacheAdapter {
  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns The cached value, or null if not found
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache (will be serialized)
   * @param ttlSeconds - Optional time-to-live in seconds
   */
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a value from cache
   * @param key - Cache key to delete
   */
  del(key: string): Promise<void>;

  /**
   * Check if a key exists in cache
   * @param key - Cache key to check
   * @returns true if key exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Create a namespaced cache adapter
   * Returns a new adapter instance with a key prefix
   * Useful for multi-tenancy, feature flags, or environment isolation
   * 
   * @param prefix - Key prefix (e.g., "tenant:123", "feature:")
   * @returns New cache adapter instance with prefix applied
   * 
   * @example
   * const tenantCache = cache.namespace("tenant:123");
   * await tenantCache.set("user:42", userData); // Actually stores as "tenant:123:user:42"
   */
  namespace?(prefix: string): CacheAdapter;

  /**
   * Health check for the cache connection
   * Optional method for monitoring and orchestration
   * 
   * @returns Health status with ok flag and optional latency
   */
  health?(): Promise<{ ok: boolean; latency?: number }>;
}

