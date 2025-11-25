import type { CacheAdapter } from "@betagors/yama-core";
import type { RedisClient } from "./client";

/**
 * Redis cache adapter implementing CacheAdapter interface
 */
export class RedisAdapter implements CacheAdapter {
  private client: RedisClient;
  private keyPrefix: string;

  constructor(client: RedisClient, keyPrefix: string = "") {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Get the underlying Redis client (for optimized rate limiting)
   * @internal
   */
  getRedisClient(): RedisClient {
    return this.client;
  }

  /**
   * Prefix a key with the namespace prefix
   */
  private prefixKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  /**
   * Serialize a value to JSON string
   */
  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize a JSON string to value
   */
  private deserialize<T>(value: string | null): T | null {
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      // If parsing fails, return null (invalid cache entry)
      return null;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const value = await this.client.get(prefixedKey);
    return this.deserialize<T>(value);
  }

  /**
   * Set a value in cache
   */
  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const serialized = this.serialize(value);

    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      // Set with expiration
      await this.client.set(prefixedKey, serialized, "EX", ttlSeconds);
    } else {
      // Set without expiration
      await this.client.set(prefixedKey, serialized);
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    await this.client.del(prefixedKey);
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const result = await this.client.exists(prefixedKey);
    return result > 0;
  }

  /**
   * Create a namespaced cache adapter
   * Returns a new adapter instance with a key prefix
   */
  namespace(prefix: string): CacheAdapter {
    const newPrefix = this.keyPrefix ? `${this.keyPrefix}:${prefix}` : prefix;
    return new RedisAdapter(this.client, newPrefix);
  }

  /**
   * Health check for the cache connection
   */
  async health(): Promise<{ ok: boolean; latency?: number }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      return { ok: true, latency };
    } catch (error) {
      return { ok: false };
    }
  }
}

