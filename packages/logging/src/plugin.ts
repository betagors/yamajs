import type { YamaPlugin, PluginContext } from "@betagors/yama-core";
import type { LoggingPluginConfig } from "./types.js";
import { Logger, createTransports } from "./logger.js";

/**
 * Logging plugin for Yama
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-logging",
  category: "logging",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(
    opts: Record<string, unknown>,
    context: PluginContext
  ): Promise<any> {
    const config = opts as LoggingPluginConfig;

    // Create transports
    const transports = await createTransports(config, {
      getPluginAPI: (name: string) => context.getPluginAPI(name),
    });

    // Create logger instance
    const logger = new Logger(config);

    // Add all transports to logger
    for (const transport of transports) {
      logger.addTransport(transport);
    }

    // Register logger as service so other plugins can access it
    context.registerService("logger", logger);
    context.logger.info("Registered logging service");

    // Return plugin API
    return {
      logger,
      transports,
      // Helper methods
      addTransport: (transport: any) => logger.addTransport(transport),
      removeTransport: (transport: any) => logger.removeTransport(transport),
      setLevel: (level: string) => logger.setLevel(level),
      getLevel: () => logger.getLevel(),
      flush: () => logger.flush(),
      close: () => logger.close(),
    };
  },

  async onStop(): Promise<void> {
    // Plugin stop hook - transports will be closed by the logger
    // This is called when the plugin is being stopped
  },

  async onHealthCheck() {
    return {
      healthy: true,
      details: {
        category: "logging",
        transports: "multiple",
      },
    };
  },
};

export default plugin;



















