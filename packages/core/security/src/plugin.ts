import type { YamaPlugin, PluginContext } from "@yamajs/kernel";
import type { SecurityPluginConfig } from "../../../../../../../core/security/src/types.js";
import { createSecurityMiddleware } from "../../../../../../../core/security/src/middleware.js";
// Note: This type is exported from @yamajs/core but may need to be imported
// from source during development. Once core is built, use: import type { MiddlewareDefinition } from "@yamajs/kernel";
import type { MiddlewareDefinition } from "../../core/src/middleware/index.js";

/**
 * Security plugin for Yama
 */
const plugin: YamaPlugin = {
  name: "@yamajs/security",
  category: "security",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(
    opts: Record<string, unknown>,
    context: PluginContext
  ): Promise<any> {
    const config = opts as SecurityPluginConfig;

    // Create security middleware
    const securityMiddleware = createSecurityMiddleware(config);

    // Return plugin API
    return {
      config,
      
      /**
       * Get middleware definitions for this plugin
       * This allows the runtime to register the middleware automatically
       */
      getMiddleware(): MiddlewareDefinition | MiddlewareDefinition[] {
        return {
          name: "@yamajs/security",
          handler: securityMiddleware,
          phases: ["pre-auth"], // Run before authentication
          priority: 10, // High priority - run early
          enabled: true,
          config: config as Record<string, unknown>,
        };
      },

      // Helper methods
      updateConfig(newConfig: Partial<SecurityPluginConfig>): void {
        Object.assign(config, newConfig);
      },

      getConfig(): SecurityPluginConfig {
        return { ...config };
      },
    };
  },

  async onStop(): Promise<void> {
    // Cleanup if needed
  },

  async onHealthCheck() {
    return {
      healthy: true,
      details: {
        category: "security",
        features: {
          cors: true,
          csrf: true,
          headers: true,
          sanitization: true,
        },
      },
    };
  },
};

export default plugin;

