import type { YamaPlugin } from "@yamajs/core";
import { RedisAdapter } from "./adapter";
import { initRedis, getRedisClient, closeRedis, type RedisClient, type RedisConfig } from "./client";

/**
 * Redis cache plugin
 */
const plugin: YamaPlugin = {
  name: "@yamajs/redis",
  category: "cache",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts?: Record<string, unknown>) {
    // Initialize Redis client with provided config
    const config = opts as RedisConfig | undefined;
    const client = await initRedis(config || {});

    // Cache the Redis constructor for the factory
    // We do this here because registerCacheProvider requires a synchronous factory,
    // but importing the library is async (ESM). By loading it during init (which is async),
    // we make it available synchronously later.
    let RedisConstructor: any;
    try {
      // Prefer ioredis for synchronous instantiation support
      const module = await import("ioredis");
      RedisConstructor = module.default;
    } catch (e) {
      // If ioredis fails, we can't easily support sync factory for yaml config yet
      // silently ignore, user calls to createCacheFromConfig('redis') will just fail/throw later
    }

    // Register provider with @yamajs/cache
    try {
      const { registerCacheProvider } = await import("@yamajs/cache");

      registerCacheProvider("redis", (redisConfig: any) => {
        if (!RedisConstructor) {
          throw new Error("Redis provider requires 'ioredis' package for YAML configuration support.");
        }
        // Create NEW client for this specific config
        const newClient = new RedisConstructor(redisConfig);
        return new RedisAdapter(newClient);
      });
    } catch (e) {
      // @yamajs/cache might not be installed or versions mismatch
      // Ignore to allow plugin to work in basic mode
    }

    // Create cache adapter
    const adapter = new RedisAdapter(client);

    // Return plugin API
    return {
      adapter,
      client,
      // Expose helper methods
      getClient: () => getRedisClient(),
      close: () => closeRedis(),
    };
  },
};

export default plugin;

