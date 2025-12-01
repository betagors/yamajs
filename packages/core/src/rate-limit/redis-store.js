/**
 * Redis-based rate limit store using sliding window algorithm
 */
export class RedisRateLimitStore {
    constructor(client) {
        this.connected = false;
        this.client = client;
        this.connected = true;
    }
    /**
     * Check and increment rate limit for a key using sliding window
     * Uses Redis sorted sets to track request timestamps
     */
    async checkAndIncrement(key, maxRequests, windowMs) {
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
        }
        catch (error) {
            // If Redis fails, throw error (caller should handle fallback)
            throw new Error(`Redis rate limit check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Cleanup is handled automatically by Redis expiration
     */
    async cleanup() {
        // Redis handles cleanup via key expiration
        // This is a no-op but implements the interface
    }
}
/**
 * Create a Redis rate limit store
 * Attempts to dynamically import and create a Redis client
 */
export async function createRedisRateLimitStore(config) {
    if (!config) {
        throw new Error("Redis configuration is required");
    }
    try {
        // Try to import ioredis first (more common)
        let Redis;
        try {
            // @ts-ignore - optional dependency
            Redis = (await import("ioredis")).default;
        }
        catch {
            // Fallback to redis package
            // @ts-ignore - optional dependency
            const redisModule = await import("redis").catch(() => null);
            Redis = redisModule?.createClient || null;
            if (!Redis) {
                throw new Error("Neither 'ioredis' nor 'redis' package is installed");
            }
        }
        let client;
        if (typeof Redis === "function" && Redis.prototype?.connect) {
            // ioredis
            const options = {};
            if (config.url) {
                options.url = config.url;
            }
            else {
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
            client = new Redis(options);
        }
        else if (typeof Redis === "function") {
            // redis package (v4+)
            // @ts-ignore - optional dependency
            const redisModule = await import("redis");
            const createClient = redisModule.createClient || redisModule.default?.createClient;
            if (!createClient) {
                throw new Error("Could not find createClient in redis package");
            }
            const options = {};
            if (config.url) {
                options.url = config.url;
            }
            else {
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
            client = createClient(options);
            await client.connect();
        }
        else {
            throw new Error("Unsupported Redis client type");
        }
        return new RedisRateLimitStore(client);
    }
    catch (error) {
        throw new Error(`Failed to create Redis rate limit store: ${error instanceof Error ? error.message : String(error)}. ` +
            `Make sure 'ioredis' or 'redis' package is installed.`);
    }
}
//# sourceMappingURL=redis-store.js.map