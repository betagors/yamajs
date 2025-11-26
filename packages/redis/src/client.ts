/**
 * Redis client interface (to avoid requiring redis as a direct dependency)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  ping(): Promise<string>;
  // Sorted set operations (for optimized rate limiting)
  zadd(key: string, score: number, member: string): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number>;
  quit(): Promise<void>;
  disconnect?(): Promise<void>;
  [key: string]: unknown; // Allow additional Redis methods
}

/**
 * Redis configuration
 */
export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  [key: string]: unknown; // Allow additional Redis options
}

let redisClient: RedisClient | null = null;

/**
 * Initialize Redis client
 * Supports both ioredis and redis packages
 */
export async function initRedis(config: RedisConfig): Promise<RedisClient> {
  if (redisClient) {
    return redisClient;
  }

  if (!config) {
    throw new Error("Redis configuration is required");
  }

  try {
    // Try to import ioredis first (more common)
    let Redis: any;
    try {
      Redis = (await import("ioredis")).default;
    } catch {
      // Fallback to redis package
      const redisModule = await import("redis");
      Redis = redisModule.createClient || redisModule.default?.createClient;
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

      client = createClient(options) as unknown as RedisClient;
      await (client as any).connect();
    } else {
      throw new Error("Unsupported Redis client type");
    }

    redisClient = client;
    return client;
  } catch (error) {
    throw new Error(
      `Failed to create Redis client: ${error instanceof Error ? error.message : String(error)}. ` +
      `Make sure 'ioredis' or 'redis' package is installed.`
    );
  }
}

/**
 * Get Redis client (must be initialized first)
 */
export function getRedisClient(): RedisClient {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call initRedis() first.");
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      if (typeof redisClient.quit === "function") {
        await redisClient.quit();
      } else if (typeof redisClient.disconnect === "function") {
        await redisClient.disconnect();
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
    redisClient = null;
  }
}

