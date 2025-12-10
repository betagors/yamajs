import { PluginContextImpl } from "./context.js";
import { PluginRegistry } from "./registry.js";
/**
 * Mock logger for testing
 */
export function createMockLogger() {
    const logs = [];
    return {
        info: (message, ...args) => {
            logs.push({ level: "info", message, args });
        },
        warn: (message, ...args) => {
            logs.push({ level: "warn", message, args });
        },
        error: (message, ...args) => {
            logs.push({ level: "error", message, args });
        },
        debug: (message, ...args) => {
            logs.push({ level: "debug", message, args });
        },
        // Expose logs for testing
        getLogs: () => logs,
        clearLogs: () => logs.length = 0,
    };
}
/**
 * Create test plugin context
 */
export function createTestPluginContext(config = {}, projectDir = process.cwd(), logger) {
    const plugins = new Map();
    const pluginAPIs = new Map();
    const testLogger = logger || createMockLogger();
    return new PluginContextImpl(config, projectDir, testLogger, plugins, pluginAPIs);
}
/**
 * Create a mock plugin
 */
export function mockPlugin(name, api = {}, options = {}) {
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
export async function testPluginIntegration(plugin1, plugin2, config1 = {}, config2 = {}) {
    const errors = [];
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
    }
    catch (error) {
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
export function createTestRegistry() {
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
export function waitForEvent(context, event, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            context.off(event, handler);
            reject(new Error(`Event ${event} not received within ${timeout}ms`));
        }, timeout);
        const handler = (data) => {
            clearTimeout(timer);
            context.off(event, handler);
            resolve(data);
        };
        context.on(event, handler);
    });
}
//# sourceMappingURL=testing.js.map