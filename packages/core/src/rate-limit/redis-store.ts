import type { RateLimitStore, RateLimitResult, RateLimitConfig } from "./types.js";

/**
 * Redis client interface (to avoid requiring redis as a direct dependency)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  eval(script: string, numKeys: number, ...keysAndArgs: (string | number)[]): Promise<unknown>;
  del(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number>;
  quit(): Promise<void>;
}

/**
 * Redis-based rate limit store using sliding window algorithm
 */
export class RedisRateLimitStore implements RateLimitStore {
  private client: RedisClient;
  private connected: boolean = false;

  constructor(client: RedisClient) {
    this.client = client;
    this.connected = true;
  }

  /**
   * Check and increment rate limit for a key using sliding window
   * Uses Redis sorted sets to track request timestamps
   */
  async checkAndIncrement(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    if (!this.connected) {
      throw new Error("Redis client is not connected");
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `rate_limit:${key}`;

    try {
      // Remove old entries outside the window
      await this.client.zremrangebyscore(redisKey, 0, windowStart);

      // Get current count
      const count = await this.client.zcard(redisKey);
      const allowed = count < maxRequests;

      if (allowed) {
        // Add current request timestamp
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
      // If Redis fails, throw error (caller should handle fallback)
      throw new Error(`Redis rate limit check failed: ${error instanceof Error ? error.message : String(error)}`);
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
 * Create a Redis rate limit store
 * Attempts to dynamically import and create a Redis client
 */
export async function createRedisRateLimitStore(
  config: any
): Promise<RedisRateLimitStore> {
  if (!config) {
    throw new Error("Redis configuration is required");
  }

  try {
    // Try to import ioredis first (more common)
    let Redis: any;
    try {
      // @ts-ignore - optional dependency
      Redis = (await import("ioredis")).default;
    } catch {
      // Fallback to redis package
      // @ts-ignore - optional dependency
      const redisModule = await import("redis").catch(() => null);
      Redis = redisModule?.createClient || null;
      if (!Redis) {
        throw new Error("Neither 'ioredis' nor 'redis' package is installed");
      }
    }

    let client: RedisClient;

    if (typeof Redis === "function" && Redis.prototype?.connect) {
      // ioredis
      const options: any = {};
      if (config.url) {
        options.url = config.url;
      } else {
        options.host = config.host || "localhost";
        options.port = config.port || 6379;
        if (config.password) {
          options.password = config.password;
        }
        if (config.db !== undefined) {
          options.db = config.db;
        }
      }
      // Merge any additional options
      Object.assign(options, config);
      delete options.url;
      delete options.host;
      delete options.port;
      delete options.password;
      delete options.db;

      client = new Redis(options) as RedisClient;
    } else if (typeof Redis === "function") {
      // redis package (v4+)
      // @ts-ignore - optional dependency
      const redisModule = await import("redis");
      const createClient = redisModule.createClient || redisModule.default?.createClient;
      
      if (!createClient) {
        throw new Error("Could not find createClient in redis package");
      }

      const options: any = {};
      if (config.url) {
        options.url = config.url;
      } else {
        options.socket = {
          host: config.host || "localhost",
          port: config.port || 6379,
        };
        if (config.password) {
          options.password = config.password;
        }
        if (config.db !== undefined) {
          options.database = config.db;
        }
      }
      // Merge any additional options
      Object.assign(options, config);
      delete options.url;
      delete options.host;
      delete options.port;
      delete options.password;
      delete options.db;

      client = createClient(options) as RedisClient;
      await (client as any).connect();
    } else {
      throw new Error("Unsupported Redis client type");
    }

    return new RedisRateLimitStore(client);
  } catch (error) {
    throw new Error(
      `Failed to create Redis rate limit store: ${error instanceof Error ? error.message : String(error)}. ` +
      `Make sure 'ioredis' or 'redis' package is installed.`
    );
  }
}

