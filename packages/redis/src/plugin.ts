import type { YamaPlugin } from "@betagors/yama-core";
import { RedisAdapter } from "./adapter";
import { initRedis, getRedisClient, closeRedis, type RedisClient, type RedisConfig } from "./client";

/**
 * Redis cache plugin
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-redis",
  category: "cache",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts?: Record<string, unknown>) {
    // Initialize Redis client with provided config
    const config = opts as RedisConfig | undefined;
    const client = await initRedis(config || {});

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

