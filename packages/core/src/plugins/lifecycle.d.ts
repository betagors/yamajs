/**
 * @yamajs/core - Plugin Lifecycle Manager
 *
 * Standardized plugin lifecycle management with proper
 * initialization, validation, and error handling.
 */
import type { YamaPlugin, PluginContext } from "./base.js";
/**
 * Plugin state in lifecycle
 */
export declare enum PluginState {
    /** Plugin is registered but not initialized */
    Registered = "registered",
    /** Plugin is currently initializing */
    Initializing = "initializing",
    /** Plugin is initialized and ready */
    Initialized = "initialized",
    /** Plugin is starting */
    Starting = "starting",
    /** Plugin is running */
    Running = "running",
    /** Plugin is stopping */
    Stopping = "stopping",
    /** Plugin is stopped */
    Stopped = "stopped",
    /** Plugin encountered an error */
    Error = "error"
}
/**
 * Plugin lifecycle entry
 */
export interface PluginLifecycleEntry {
    plugin: YamaPlugin;
    state: PluginState;
    api?: unknown;
    error?: Error;
    initTime?: number;
    startTime?: number;
}
/**
 * Lifecycle manager options
 */
export interface LifecycleManagerOptions {
    /** Core version for compatibility check */
    coreVersion: string;
    /** Whether to fail fast on plugin errors */
    failFast?: boolean;
    /** Timeout for plugin operations in ms */
    timeout?: number;
    /** Logger for lifecycle events */
    logger?: {
        info(message: string, ...args: unknown[]): void;
        warn(message: string, ...args: unknown[]): void;
        error(message: string, ...args: unknown[]): void;
        debug(message: string, ...args: unknown[]): void;
    };
}
/**
 * Plugin lifecycle manager
 */
export declare class PluginLifecycleManager {
    private plugins;
    private initOrder;
    private options;
    constructor(options: LifecycleManagerOptions);
    /**
     * Register a plugin
     */
    register(plugin: YamaPlugin): void;
    /**
     * Initialize a single plugin
     */
    initializePlugin(name: string, config: Record<string, unknown>, context: PluginContext): Promise<unknown>;
    /**
     * Initialize all registered plugins
     */
    initializeAll(configs: Record<string, Record<string, unknown>>, context: PluginContext): Promise<Map<string, unknown>>;
    /**
     * Start a plugin
     */
    startPlugin(name: string): Promise<void>;
    /**
     * Start all initialized plugins
     */
    startAll(): Promise<void>;
    /**
     * Stop a plugin
     */
    stopPlugin(name: string): Promise<void>;
    /**
     * Stop all plugins (in reverse init order)
     */
    stopAll(): Promise<void>;
    /**
     * Health check all plugins
     */
    healthCheck(): Promise<Map<string, {
        healthy: boolean;
        state: PluginState;
        details?: Record<string, unknown>;
        error?: string;
    }>>;
    /**
     * Get plugin state
     */
    getState(name: string): PluginState | null;
    /**
     * Get plugin API
     */
    getAPI(name: string): unknown | null;
    /**
     * Get all plugin entries
     */
    getAll(): Map<string, PluginLifecycleEntry>;
    /**
     * Sort plugins by dependencies (topological sort)
     */
    private sortByDependencies;
    /**
     * Create timeout promise
     */
    private timeout;
}
/**
 * Create a plugin lifecycle manager
 */
export declare function createLifecycleManager(options: LifecycleManagerOptions): PluginLifecycleManager;
//# sourceMappingURL=lifecycle.d.ts.map