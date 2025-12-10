import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectHealthStatus } from "./health-checker.js";
import type { PluginContext, YamaPlugin } from "@betagors/yama-core";
import type { HealthPluginConfig, ComponentHealth } from "./types.js";

describe("Health Checker", () => {
  let mockContext: PluginContext;
  let mockPlugins: YamaPlugin[];

  beforeEach(() => {
    mockPlugins = [];
    mockContext = {
      config: {},
      projectDir: "/test",
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      getPlugin: vi.fn(),
      getPluginAPI: vi.fn(),
      getPluginsByCategory: vi.fn(() => mockPlugins),
      registerService: vi.fn(),
      getService: vi.fn(),
      hasService: vi.fn(),
      getMiddlewareRegistry: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    };
  });

  describe("collectHealthStatus", () => {
    it("should collect health status from plugins", async () => {
      const plugin1: YamaPlugin = {
        name: "test-plugin-1",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => ({
          healthy: true,
          details: { test: "data" },
        }),
      };

      const plugin2: YamaPlugin = {
        name: "test-plugin-2",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => ({
          healthy: true,
        }),
      };

      mockPlugins.push(plugin1, plugin2);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.healthy).toBe(true);
      expect(status.status).toBe(200);
      expect(status.components).toHaveLength(2);
      expect(status.components[0].name).toBe("test-plugin-1");
      expect(status.components[0].healthy).toBe(true);
      expect(status.components[1].name).toBe("test-plugin-2");
      expect(status.components[1].healthy).toBe(true);
      expect(status.summary.total).toBe(2);
      expect(status.summary.healthy).toBe(2);
      expect(status.summary.unhealthy).toBe(0);
    });

    it("should handle plugins without health checks", async () => {
      const plugin: YamaPlugin = {
        name: "test-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        // No onHealthCheck method
      };

      mockPlugins.push(plugin);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.healthy).toBe(true);
      expect(status.components).toHaveLength(1);
      expect(status.components[0].name).toBe("test-plugin");
      expect(status.components[0].healthy).toBe(true);
      expect(status.components[0].details).toEqual({ hasHealthCheck: false });
    });

    it("should handle async health checks", async () => {
      const plugin: YamaPlugin = {
        name: "test-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            healthy: true,
            details: { async: true },
          };
        },
      };

      mockPlugins.push(plugin);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.healthy).toBe(true);
      expect(status.components[0].healthy).toBe(true);
      expect(status.components[0].responseTime).toBeGreaterThan(0);
    });

    it("should handle plugin health check errors", async () => {
      const plugin: YamaPlugin = {
        name: "failing-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => {
          throw new Error("Health check failed");
        },
      };

      mockPlugins.push(plugin);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.healthy).toBe(false);
      expect(status.status).toBe(503);
      expect(status.components).toHaveLength(1);
      expect(status.components[0].healthy).toBe(false);
      expect(status.components[0].error).toBe("Health check failed");
      expect(status.summary.unhealthy).toBe(1);
    });

    it("should run custom health checks", async () => {
      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      customChecks.set("custom-check", () => ({
        name: "custom-check",
        healthy: true,
        details: { custom: true },
      }));

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.components).toHaveLength(1);
      expect(status.components[0].name).toBe("custom-check");
      expect(status.components[0].healthy).toBe(true);
    });

    it("should handle custom health check errors", async () => {
      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      customChecks.set("failing-check", () => {
        throw new Error("Custom check failed");
      });

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.healthy).toBe(false);
      expect(status.components[0].healthy).toBe(false);
      expect(status.components[0].error).toBe("Custom check failed");
    });

    it("should exclude components when configured", async () => {
      const plugin1: YamaPlugin = {
        name: "included-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => ({ healthy: true }),
      };

      const plugin2: YamaPlugin = {
        name: "excluded-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => ({ healthy: false }),
      };

      mockPlugins.push(plugin1, plugin2);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
        excludeComponents: ["excluded-plugin"],
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.components).toHaveLength(1);
      expect(status.components[0].name).toBe("included-plugin");
      expect(status.healthy).toBe(true);
    });

    it("should check critical components", async () => {
      const plugin1: YamaPlugin = {
        name: "critical-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => ({ healthy: false }),
      };

      const plugin2: YamaPlugin = {
        name: "non-critical-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => ({ healthy: true }),
      };

      mockPlugins.push(plugin1, plugin2);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
        criticalComponents: ["critical-plugin"],
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.healthy).toBe(false);
      expect(status.status).toBe(503);
    });

    it("should include system info when configured", async () => {
      const config: HealthPluginConfig = {
        includeSystemInfo: true,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.system).toBeDefined();
      expect(status.system?.nodeVersion).toBeDefined();
      expect(status.system?.platform).toBeDefined();
      expect(status.system?.memory).toBeDefined();
      expect(status.system?.memory?.used).toBeGreaterThan(0);
      expect(status.system?.memory?.total).toBeGreaterThan(0);
      expect(status.system?.memory?.percentage).toBeGreaterThanOrEqual(0);
    });

    it("should not include system info when not configured", async () => {
      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.system).toBeUndefined();
    });

    it("should calculate uptime correctly", async () => {
      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now() - 5000; // 5 seconds ago

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.uptime).toBeGreaterThanOrEqual(4);
      expect(status.uptime).toBeLessThanOrEqual(6);
    });

    it("should include response times for components", async () => {
      const plugin: YamaPlugin = {
        name: "test-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { healthy: true };
        },
      };

      mockPlugins.push(plugin);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.components[0].responseTime).toBeGreaterThanOrEqual(50);
    });

    it("should summarize component health correctly", async () => {
      const healthyPlugin: YamaPlugin = {
        name: "healthy-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => ({ healthy: true }),
      };

      const unhealthyPlugin: YamaPlugin = {
        name: "unhealthy-plugin",
        category: "test",
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        onHealthCheck: () => {
          throw new Error("Failed");
        },
      };

      mockPlugins.push(healthyPlugin, unhealthyPlugin);

      const config: HealthPluginConfig = {
        includeSystemInfo: false,
        includeDetails: true,
      };

      const customChecks = new Map<string, () => Promise<ComponentHealth> | ComponentHealth>();
      const startTime = Date.now();

      const status = await collectHealthStatus(mockContext, config, customChecks, startTime);

      expect(status.summary.total).toBe(2);
      expect(status.summary.healthy).toBe(1);
      expect(status.summary.unhealthy).toBe(1);
    });
  });
});

