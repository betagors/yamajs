import type { YamaPlugin, PluginContext, Logger } from "./base.js";
import { PluginRegistry } from "./registry.js";
/**
 * Mock logger for testing
 */
export declare function createMockLogger(): Logger;
/**
 * Create test plugin context
 */
export declare function createTestPluginContext(config?: Record<string, unknown>, projectDir?: string, logger?: Logger): PluginContext;
/**
 * Create a mock plugin
 */
export declare function mockPlugin(name: string, api?: any, options?: {
    category?: string;
    version?: string;
    onHealthCheck?: () => Promise<{
        healthy: boolean;
    }> | {
        healthy: boolean;
    };
}): YamaPlugin;
/**
 * Test plugin integration
 */
export declare function testPluginIntegration(plugin1: YamaPlugin, plugin2: YamaPlugin, config1?: Record<string, unknown>, config2?: Record<string, unknown>): Promise<{
    success: boolean;
    errors: string[];
    plugin1API: any;
    plugin2API: any;
}>;
/**
 * Create isolated test registry
 */
export declare function createTestRegistry(): {
    registry: PluginRegistry;
    context: PluginContext;
};
/**
 * Wait for event
 */
export declare function waitForEvent(context: PluginContext, event: string, timeout?: number): Promise<any>;
