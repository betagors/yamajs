import type { YamaPlugin } from "@yamajs/kernel";
import { RealtimeAdapter } from "./adapter";
import { ChannelRegistry } from "./channel";
import { setupWebSocketServer } from "./server";
import { setupEntityEvents } from "./entity-events";
import { logEvent } from "./dev-tools";
import type { RealtimeConfig, RealtimeChannelConfig, RealtimeEntityConfig } from "./types";

/**
 * Realtime plugin API
 */
export interface RealtimePluginAPI {
  adapter: RealtimeAdapter;
  registerChannel: (channel: RealtimeChannelConfig) => void;
  setupEntityEvents: (entityConfigs: Record<string, RealtimeEntityConfig>, repositories?: Record<string, any>) => void;
}

/**
 * Realtime plugin
 */
const plugin: YamaPlugin = {
  name: "@yamajs/realtime",
  category: "realtime",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts?: Record<string, unknown>) {
    const config = (opts || {}) as RealtimeConfig;
    
    // Get Redis client if available and enabled
    let redisClient: any = null;
    const useRedis = config.redis !== false; // Default to true if not specified
    
    if (useRedis) {
      // Try to get Redis client from cache plugin
      // Check if it's passed in opts (runtime will pass it)
      if (opts && "redisClient" in opts) {
        redisClient = opts.redisClient;
      }
    }

    // Create adapter
    const adapter = new RealtimeAdapter(redisClient, useRedis);

    // Create channel registry
    const channelRegistry = new ChannelRegistry();

    // Store server instance and config for later setup
    // We'll need to call setupWebSocketServer after the server is created
    let serverInstance: any = null;
    let authConfig: any = null;
    let customAuthHandlers = new Map<string, (auth: any, params: Record<string, string>) => Promise<boolean> | boolean>();

    // Return plugin API
    return {
      adapter,
      channelRegistry,
      config,
      serverInstance: null, // Will be set by runtime
      authConfig: null, // Will be set by runtime
      customAuthHandlers,
      
      // Methods for runtime to call
      setupServer: async (server: any, auth: any) => {
        serverInstance = server;
        authConfig = auth;
        await setupWebSocketServer(server, adapter, channelRegistry, config, auth, customAuthHandlers);
      },
      
      registerChannel: (channel: RealtimeChannelConfig) => {
        channelRegistry.register(channel);
      },
      
      setupEntityEvents: (entityConfigs: Record<string, RealtimeEntityConfig>, repositories?: Record<string, any>) => {
        setupEntityEvents(adapter, entityConfigs, repositories);
      },
    } as RealtimePluginAPI & {
      channelRegistry: ChannelRegistry;
      config: RealtimeConfig;
      serverInstance: any;
      authConfig: any;
      customAuthHandlers: Map<string, (auth: any, params: Record<string, string>) => Promise<boolean> | boolean>;
      setupServer: (server: any, auth: any) => Promise<void>;
    };
  },
};

export default plugin;

