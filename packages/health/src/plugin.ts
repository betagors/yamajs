import type { YamaPlugin, PluginContext } from "@betagors/yama-core";
import type { HealthPluginConfig, HealthStatus, ComponentHealth } from "./types.js";
import { collectHealthStatus } from "./health-checker.js";

/**
 * Health plugin API
 */
export interface HealthPluginAPI {
  /**
   * Get comprehensive health status
   */
  getHealth(): Promise<HealthStatus>;

  /**
   * Get health status synchronously (may be less accurate)
   */
  getHealthSync(): HealthStatus;

  /**
   * Check if the system is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: () => Promise<ComponentHealth> | ComponentHealth): void;

  /**
   * Unregister a custom health check
   */
  unregisterCheck(name: string): void;

  /**
   * Get health status for a specific component
   */
  getComponentHealth(componentName: string): Promise<ComponentHealth | null>;

  /**
   * Update plugin configuration
   */
  updateConfig(config: Partial<HealthPluginConfig>): void;

  /**
   * Get current configuration
   */
  getConfig(): HealthPluginConfig;
}

/**
 * Health plugin implementation
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-health",
  category: "observability",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(
    opts: Record<string, unknown>,
    context: PluginContext
  ): Promise<HealthPluginAPI> {
    const config: HealthPluginConfig = {
      path: "/health",
      includeSystemInfo: true,
      includeDetails: true,
      excludeComponents: [],
      criticalComponents: [],
      customChecks: [],
      ...(opts as Partial<HealthPluginConfig>),
    };

    // Store custom checks
    const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();

    // Register custom checks from config
    if (config.customChecks) {
      for (const check of config.customChecks) {
        customChecks.set(check.name, check.check);
      }
    }

    // Track start time for uptime calculation
    const startTime = Date.now();

    // Create health check function
    const performHealthCheck = async (): Promise<HealthStatus> => {
      return await collectHealthStatus(
        context,
        config,
        customChecks,
        startTime
      );
    };

    // Create synchronous health check (less accurate, doesn't wait for async checks)
    const performHealthCheckSync = (): HealthStatus => {
      const components: ComponentHealth[] = [];
      const allPlugins = context.getPluginsByCategory("");

      // Check all plugins synchronously
      for (const plugin of allPlugins) {
        if (config.excludeComponents?.includes(plugin.name)) {
          continue;
        }

        try {
          if (plugin.onHealthCheck) {
            const result = plugin.onHealthCheck();
            if (result instanceof Promise) {
              // For sync version, we can't wait for promises
              components.push({
                name: plugin.name,
                healthy: true, // Assume healthy if async
                details: { async: true },
              });
            } else {
              components.push({
                name: plugin.name,
                ...result,
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            // Plugin doesn't have health check, assume healthy
            components.push({
              name: plugin.name,
              healthy: true,
              details: { hasHealthCheck: false },
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          components.push({
            name: plugin.name,
            healthy: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Run custom checks synchronously
      for (const [name, check] of customChecks.entries()) {
        try {
          const result = check();
          if (result instanceof Promise) {
            components.push({
              name,
              healthy: true,
              details: { async: true },
            });
          } else {
            components.push({
              ...result,
              name: result.name || name,
              timestamp: result.timestamp || new Date().toISOString(),
            });
          }
        } catch (error) {
          components.push({
            name,
            healthy: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      }

      const healthy = components.every((c) => c.healthy);
      const criticalHealthy = config.criticalComponents
        ? config.criticalComponents.every((name) => {
            const component = components.find((c) => c.name === name);
            return component?.healthy !== false;
          })
        : true;

      const overallHealthy = healthy && criticalHealthy;

      return {
        healthy: overallHealthy,
        status: overallHealthy ? 200 : 503,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        components,
        summary: {
          total: components.length,
          healthy: components.filter((c) => c.healthy).length,
          unhealthy: components.filter((c) => !c.healthy).length,
        },
      };
    };

    // Create and return API
    const api: HealthPluginAPI = {
      async getHealth(): Promise<HealthStatus> {
        return await performHealthCheck();
      },

      getHealthSync(): HealthStatus {
        return performHealthCheckSync();
      },

      async isHealthy(): Promise<boolean> {
        const status = await performHealthCheck();
        return status.healthy;
      },

      registerCheck(
        name: string,
        check: () => Promise<ComponentHealth> | ComponentHealth
      ): void {
        customChecks.set(name, check);
        context.logger.debug(`Registered custom health check: ${name}`);
      },

      unregisterCheck(name: string): void {
        customChecks.delete(name);
        context.logger.debug(`Unregistered custom health check: ${name}`);
      },

      async getComponentHealth(
        componentName: string
      ): Promise<ComponentHealth | null> {
        const status = await performHealthCheck();
        return (
          status.components.find((c) => c.name === componentName) || null
        );
      },

      updateConfig(newConfig: Partial<HealthPluginConfig>): void {
        Object.assign(config, newConfig);
      },

      getConfig(): HealthPluginConfig {
        return { ...config };
      },
    };

    // Register as health service
    context.registerService("health", api);
    context.logger.info("Health service registered");

    // Listen for plugin lifecycle events to track health
    context.on("plugin:loaded", ({ name }: { name: string }) => {
      context.logger.debug(`Plugin loaded, will be included in health checks: ${name}`);
    });

    context.on("plugin:error", ({ name, error }: { name: string; error: Error }) => {
      context.logger.warn(`Plugin error detected: ${name}`, error);
    });

    return api;
  },

  async onHealthCheck() {
    return {
      healthy: true,
      details: {
        category: "observability",
        service: "health",
      },
    };
  },
};

export default plugin;

