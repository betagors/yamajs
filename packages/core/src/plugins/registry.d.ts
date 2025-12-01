import type { YamaPlugin, Logger } from "./base.js";
import type { MiddlewareRegistry } from "../middleware/registry.js";
/**
 * Plugin registry
 */
export declare class PluginRegistry {
    private plugins;
    private manifests;
    private packageDirs;
    private pluginAPIs;
    private pluginContexts;
    private config;
    private projectDir;
    private logger;
    private middlewareRegistry;
    /**
     * Get database connection from database plugin if available
     */
    private getDatabaseConnection;
    /**
     * Set registry configuration
     */
    setConfig(config: Record<string, unknown>, projectDir: string, logger?: Logger): void;
    /**
     * Set middleware registry (called by runtime after creating middleware registry)
     */
    setMiddlewareRegistry(middlewareRegistry: MiddlewareRegistry): void;
    /**
     * Create default logger
     */
    private createDefaultLogger;
    /**
     * Create plugin context
     */
    private createContext;
    /**
     * Load and register a plugin
     * @param packageName - Name of the package to load
     * @param projectDir - Optional project directory to resolve packages from
     * @param pluginConfig - Plugin configuration options
     * @param skipDependencies - Skip dependency loading (for internal use)
     */
    loadPlugin(packageName: string, projectDir?: string, pluginConfig?: Record<string, unknown>, skipDependencies?: boolean): Promise<YamaPlugin>;
    /**
     * Get a loaded plugin by package name
     */
    getPlugin(packageName: string): YamaPlugin | null;
    /**
     * Get all loaded plugins
     */
    getAllPlugins(): YamaPlugin[];
    /**
     * Get plugin by category
     */
    getPluginByCategory(category: string): YamaPlugin | null;
    /**
     * Get all plugins by category
     */
    getPluginsByCategory(category: string): YamaPlugin[];
    /**
     * Get plugin by type (for backward compatibility)
     */
    getPluginByType(type: string): YamaPlugin | null;
    /**
     * Get package directory for a plugin
     */
    getPackageDir(packageName: string): string | null;
    /**
     * Get plugin API
     */
    getPluginAPI(packageName: string): any;
    /**
     * Get all registered CLI commands from all plugins
     */
    getAllCLICommands(): import("./base.js").PluginCLICommand[];
    /**
     * Get all registered MCP tools from all plugins
     */
    getAllMCPTools(): import("./base.js").PluginMCPTool[];
    /**
     * Clear all plugins
     */
    clear(): void;
}
export declare const pluginRegistry: PluginRegistry;
/**
 * Set registry configuration (call before loading plugins)
 */
export declare function setPluginRegistryConfig(config: Record<string, unknown>, projectDir: string, logger?: Logger): void;
/**
 * Load a plugin
 * @param packageName - Name of the package to load
 * @param projectDir - Optional project directory to resolve packages from
 * @param pluginConfig - Plugin configuration
 */
export declare function loadPlugin(packageName: string, projectDir?: string, pluginConfig?: Record<string, unknown>): Promise<YamaPlugin>;
/**
 * Get a plugin by package name
 */
export declare function getPlugin(packageName: string): YamaPlugin | null;
/**
 * Get plugin API
 */
export declare function getPluginAPI(packageName: string): any;
/**
 * Get all loaded plugins
 */
export declare function getAllPlugins(): YamaPlugin[];
/**
 * Get plugin by category
 */
export declare function getPluginByCategory(category: string): YamaPlugin | null;
/**
 * Get all plugins by category
 */
export declare function getPluginsByCategory(category: string): YamaPlugin[];
/**
 * Get plugin by type
 */
export declare function getPluginByType(type: string): YamaPlugin | null;
/**
 * Get all registered CLI commands from all plugins
 */
export declare function getAllCLICommands(): import("./base.js").PluginCLICommand[];
/**
 * Get all registered MCP tools from all plugins
 */
export declare function getAllMCPTools(): import("./base.js").PluginMCPTool[];
