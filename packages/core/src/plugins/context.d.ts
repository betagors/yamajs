import type { YamaPlugin, PluginCLICommand, PluginMCPTool } from "./base.js";
import type { MiddlewareRegistry } from "../middleware/registry.js";
/**
 * Logger interface for plugins
 */
export interface Logger {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}
/**
 * Plugin context implementation
 */
export declare class PluginContextImpl {
    readonly config: Record<string, unknown>;
    readonly projectDir: string;
    readonly logger: Logger;
    private pluginRegistry;
    private pluginAPIs;
    private eventEmitter;
    private serviceRegistry;
    private cliCommandRegistry;
    private mcpToolRegistry;
    private middlewareRegistry;
    constructor(config: Record<string, unknown>, projectDir: string, logger: Logger, pluginRegistry: Map<string, YamaPlugin>, pluginAPIs: Map<string, any>, middlewareRegistry?: MiddlewareRegistry | null);
    /**
     * Get a plugin by name
     */
    getPlugin(name: string): YamaPlugin | null;
    /**
     * Get plugin API (returned from init())
     */
    getPluginAPI(name: string): any;
    /**
     * Get all plugins by category
     */
    getPluginsByCategory(category: string): YamaPlugin[];
    /**
     * Register a service
     */
    registerService(name: string, service: any): void;
    /**
     * Get a service by name
     */
    getService(name: string): any;
    /**
     * Check if a service exists
     */
    hasService(name: string): boolean;
    /**
     * Get middleware registry to register middleware
     */
    getMiddlewareRegistry(): MiddlewareRegistry;
    /**
     * Emit an event
     */
    emit(event: string, data?: any): void;
    /**
     * Listen to an event
     */
    on(event: string, handler: Function): void;
    /**
     * Remove event listener
     */
    off(event: string, handler: Function): void;
    /**
     * Listen to an event once
     */
    once(event: string, handler: Function): void;
    /**
     * Register a CLI command
     */
    registerCLICommand(command: PluginCLICommand): void;
    /**
     * Get all registered CLI commands
     */
    getCLICommands(): PluginCLICommand[];
    /**
     * Get a CLI command by name
     */
    getCLICommand(name: string): PluginCLICommand | undefined;
    /**
     * Register an MCP tool
     */
    registerMCPTool(tool: PluginMCPTool): void;
    /**
     * Get all registered MCP tools
     */
    getMCPTools(): PluginMCPTool[];
    /**
     * Get an MCP tool by name
     */
    getMCPTool(name: string): PluginMCPTool | undefined;
}
