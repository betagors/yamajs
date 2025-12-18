import type { YamaPlugin, PluginContext, Logger } from "./base.js";
import { PluginContextImpl } from "./context.js";
import { PluginRegistry } from "./registry.js";

/**
 * Mock logger for testing
 */
export function createMockLogger(): Logger {
  const logs: Array<{ level: string; message: string; args: any[] }> = [];

  return {
    info: (message: string, ...args: any[]) => {
      logs.push({ level: "info", message, args });
    },
    warn: (message: string, ...args: any[]) => {
      logs.push({ level: "warn", message, args });
    },
    error: (message: string, ...args: any[]) => {
      logs.push({ level: "error", message, args });
    },
    debug: (message: string, ...args: any[]) => {
      logs.push({ level: "debug", message, args });
    },
    // Expose logs for testing
    getLogs: () => logs,
    clearLogs: () => logs.length = 0,
  } as Logger & { getLogs(): typeof logs; clearLogs(): void };
}

/**
 * Create test plugin context
 */
export function createTestPluginContext(
  config: Record<string, unknown> = {},
  projectDir: string = process.cwd(),
  logger?: Logger
): PluginContext {
  const plugins = new Map<string, YamaPlugin>();
  const pluginAPIs = new Map<string, any>();
  const testLogger = logger || createMockLogger();

  return new PluginContextImpl(
    config,
    projectDir,
    testLogger,
    plugins,
    pluginAPIs
  );
}

/**
 * Create a mock plugin
 */
export function mockPlugin(
  name: string,
  api: any = {},
  options: {
    category?: string;
    version?: string;
    onHealthCheck?: () => Promise<{ healthy: boolean }> | { healthy: boolean };
  } = {}
): YamaPlugin {
  return {
    name,
    category: options.category,
    version: options.version || "1.0.0",
    async init(opts, context) {
      return api;
    },
    onHealthCheck: options.onHealthCheck,
  };
}

/**
 * Test plugin integration
 */
export async function testPluginIntegration(
  plugin1: YamaPlugin,
  plugin2: YamaPlugin,
  config1: Record<string, unknown> = {},
  config2: Record<string, unknown> = {}
): Promise<{
  success: boolean;
  errors: string[];
  plugin1API: any;
  plugin2API: any;
}> {
  const errors: string[] = [];
  const context = createTestPluginContext();

  try {
    // Initialize plugin1
    const api1 = await plugin1.init(config1, context);
    context.registerService(plugin1.name, api1);

    // Initialize plugin2 (can now access plugin1 via context)
    const api2 = await plugin2.init(config2, context);
    context.registerService(plugin2.name, api2);

    return {
      success: true,
      errors: [],
      plugin1API: api1,
      plugin2API: api2,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      success: false,
      errors,
      plugin1API: null,
      plugin2API: null,
    };
  }
}

/**
 * Create isolated test registry
 */
export function createTestRegistry(): {
  registry: PluginRegistry;
  context: PluginContext;
} {
  const registry = new PluginRegistry();
  const config = {};
  const projectDir = process.cwd();
  const logger = createMockLogger();
  
  registry.setConfig(config, projectDir, logger);
  // Create context using the public method by loading a dummy plugin
  // or create it directly
  const context = createTestPluginContext(config, projectDir, logger);

  return { registry, context };
}

/**
 * Wait for event
 */
export function waitForEvent(
  context: PluginContext,
  event: string,
  timeout: number = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      context.off(event, handler);
      reject(new Error(`Event ${event} not received within ${timeout}ms`));
    }, timeout);

    const handler = (data: any) => {
      clearTimeout(timer);
      context.off(event, handler);
      resolve(data);
    };

    context.on(event, handler);
  });
}

