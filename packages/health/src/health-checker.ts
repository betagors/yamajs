import type { PluginContext } from "@betagors/yama-core";
import type {
  HealthPluginConfig,
  HealthStatus,
  ComponentHealth,
} from "./types.js";

/**
 * Collect system information
 */
function getSystemInfo(): HealthStatus["system"] {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const memoryPercentage = (usedMemory / totalMemory) * 100;

  return {
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round(memoryPercentage * 100) / 100,
    },
  };
}

/**
 * Collect health status from all plugins and components
 */
export async function collectHealthStatus(
  context: PluginContext,
  config: HealthPluginConfig,
  customChecks: Map<string, () => Promise<ComponentHealth> | ComponentHealth>,
  startTime: number
): Promise<HealthStatus> {
  const components: ComponentHealth[] = [];
  const checkStartTime = Date.now();

  // Check all plugins
  const allPlugins = context.getPluginsByCategory("");
  for (const plugin of allPlugins) {
    if (config.excludeComponents?.includes(plugin.name)) {
      continue;
    }

    const componentStartTime = Date.now();
    try {
      if (plugin.onHealthCheck) {
        const result = await Promise.resolve(plugin.onHealthCheck());
        const responseTime = Date.now() - componentStartTime;

        components.push({
          name: plugin.name,
          ...result,
          timestamp: new Date().toISOString(),
          responseTime,
        });
      } else {
        // Plugin doesn't have health check, assume healthy
        components.push({
          name: plugin.name,
          healthy: true,
          details: { hasHealthCheck: false },
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - componentStartTime,
        });
      }
    } catch (error) {
      components.push({
        name: plugin.name,
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - componentStartTime,
      });
    }
  }

  // Run custom health checks
  for (const [name, check] of customChecks.entries()) {
    const componentStartTime = Date.now();
    try {
      const result = await Promise.resolve(check());
      const responseTime = Date.now() - componentStartTime;

      components.push({
        ...result,
        name: result.name || name,
        timestamp: result.timestamp || new Date().toISOString(),
        responseTime: result.responseTime || responseTime,
      });
    } catch (error) {
      components.push({
        name,
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - componentStartTime,
      });
    }
  }

  // Calculate overall health
  const allHealthy = components.every((c) => c.healthy);
  
  // Check critical components
  const criticalHealthy = config.criticalComponents
    ? config.criticalComponents.every((name) => {
        const component = components.find((c) => c.name === name);
        return component?.healthy !== false;
      })
    : true;

  const overallHealthy = allHealthy && criticalHealthy;

  // Build health status
  const status: HealthStatus = {
    healthy: overallHealthy,
    status: overallHealthy ? 200 : 503,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    components: config.includeDetails ? components : components.map((c) => ({
      name: c.name,
      healthy: c.healthy,
      error: c.error,
    })),
    summary: {
      total: components.length,
      healthy: components.filter((c) => c.healthy).length,
      unhealthy: components.filter((c) => !c.healthy).length,
    },
  };

  // Add system information if requested
  if (config.includeSystemInfo) {
    status.system = getSystemInfo();
  }

  return status;
}



















