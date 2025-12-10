/**
 * @betagors/yama-core - Plugin Lifecycle Manager
 * 
 * Standardized plugin lifecycle management with proper
 * initialization, validation, and error handling.
 */

import type { YamaPlugin, PluginContext, PluginManifest } from "./base.js";
import { validateYamaPlugin, validatePluginConfig, validatePluginVersion } from "./validator.js";
import { ErrorCodes } from "@betagors/yama-errors";

/**
 * Plugin state in lifecycle
 */
export enum PluginState {
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
  Error = "error",
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
export class PluginLifecycleManager {
  private plugins: Map<string, PluginLifecycleEntry> = new Map();
  private initOrder: string[] = [];
  private options: Required<LifecycleManagerOptions>;
  
  constructor(options: LifecycleManagerOptions) {
    this.options = {
      failFast: false,
      timeout: 30000,
      logger: {
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: () => {},
      },
      ...options,
    };
  }
  
  /**
   * Register a plugin
   */
  register(plugin: YamaPlugin): void {
    // Validate plugin structure
    const validation = validateYamaPlugin(plugin);
    if (!validation.valid) {
      const error = new Error(`Invalid plugin: ${validation.errors?.join(", ")}`);
      (error as any).code = ErrorCodes.PLUGIN_CONFIG_INVALID;
      throw error;
    }
    
    // Check if already registered
    if (this.plugins.has(plugin.name)) {
      const error = new Error(`Plugin ${plugin.name} is already registered`);
      (error as any).code = ErrorCodes.CONFLICT_EXISTS;
      throw error;
    }
    
    // Validate version compatibility
    const versionResult = validatePluginVersion(plugin, this.options.coreVersion);
    if (!versionResult.valid) {
      const error = new Error(`Plugin ${plugin.name} version incompatible: ${versionResult.errors?.join(", ")}`);
      (error as any).code = ErrorCodes.PLUGIN_VERSION_INCOMPATIBLE;
      throw error;
    }
    
    // Register
    this.plugins.set(plugin.name, {
      plugin,
      state: PluginState.Registered,
    });
    
    this.options.logger.debug(`Registered plugin: ${plugin.name}`);
  }
  
  /**
   * Initialize a single plugin
   */
  async initializePlugin(
    name: string,
    config: Record<string, unknown>,
    context: PluginContext
  ): Promise<unknown> {
    const entry = this.plugins.get(name);
    if (!entry) {
      const error = new Error(`Plugin ${name} not found`);
      (error as any).code = ErrorCodes.PLUGIN_NOT_FOUND;
      throw error;
    }
    
    if (entry.state !== PluginState.Registered) {
      throw new Error(`Plugin ${name} is already ${entry.state}`);
    }
    
    const { plugin } = entry;
    
    // Validate config against manifest schema
    if (plugin.manifest) {
      const configValidation = validatePluginConfig(config, plugin.manifest);
      if (!configValidation.valid) {
        entry.state = PluginState.Error;
        entry.error = new Error(`Invalid config: ${configValidation.errors?.join(", ")}`);
        (entry.error as any).code = ErrorCodes.PLUGIN_CONFIG_INVALID;
        throw entry.error;
      }
    }
    
    entry.state = PluginState.Initializing;
    const startTime = Date.now();
    
    try {
      // Call onInit if defined
      if (plugin.onInit) {
        await Promise.race([
          plugin.onInit(config),
          this.timeout(`Plugin ${name} onInit timeout`),
        ]);
      }
      
      // Call init
      const api = await Promise.race([
        plugin.init(config, context),
        this.timeout(`Plugin ${name} init timeout`),
      ]);
      
      entry.api = api;
      entry.state = PluginState.Initialized;
      entry.initTime = Date.now() - startTime;
      
      this.initOrder.push(name);
      this.options.logger.info(`Initialized plugin: ${name} (${entry.initTime}ms)`);
      
      return api;
    } catch (error) {
      entry.state = PluginState.Error;
      entry.error = error instanceof Error ? error : new Error(String(error));
      
      // Call onError if defined
      if (plugin.onError) {
        try {
          plugin.onError(entry.error);
        } catch {
          // Ignore errors in error handler
        }
      }
      
      this.options.logger.error(`Failed to initialize plugin ${name}:`, entry.error);
      
      if (this.options.failFast) {
        throw entry.error;
      }
      
      return null;
    }
  }
  
  /**
   * Initialize all registered plugins
   */
  async initializeAll(
    configs: Record<string, Record<string, unknown>>,
    context: PluginContext
  ): Promise<Map<string, unknown>> {
    const apis = new Map<string, unknown>();
    
    // Sort by dependencies if available
    const sorted = this.sortByDependencies();
    
    for (const name of sorted) {
      const config = configs[name] || {};
      try {
        const api = await this.initializePlugin(name, config, context);
        if (api !== null) {
          apis.set(name, api);
        }
      } catch (error) {
        if (this.options.failFast) {
          throw error;
        }
      }
    }
    
    return apis;
  }
  
  /**
   * Start a plugin
   */
  async startPlugin(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    if (entry.state !== PluginState.Initialized) {
      throw new Error(`Plugin ${name} must be initialized before starting (current: ${entry.state})`);
    }
    
    entry.state = PluginState.Starting;
    const startTime = Date.now();
    
    try {
      if (entry.plugin.onStart) {
        await Promise.race([
          entry.plugin.onStart(),
          this.timeout(`Plugin ${name} onStart timeout`),
        ]);
      }
      
      entry.state = PluginState.Running;
      entry.startTime = Date.now() - startTime;
      
      this.options.logger.debug(`Started plugin: ${name} (${entry.startTime}ms)`);
    } catch (error) {
      entry.state = PluginState.Error;
      entry.error = error instanceof Error ? error : new Error(String(error));
      
      if (entry.plugin.onError) {
        try {
          entry.plugin.onError(entry.error);
        } catch {
          // Ignore
        }
      }
      
      throw entry.error;
    }
  }
  
  /**
   * Start all initialized plugins
   */
  async startAll(): Promise<void> {
    for (const name of this.initOrder) {
      const entry = this.plugins.get(name);
      if (entry?.state === PluginState.Initialized) {
        await this.startPlugin(name);
      }
    }
  }
  
  /**
   * Stop a plugin
   */
  async stopPlugin(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) {
      return; // Plugin not registered, nothing to stop
    }
    
    if (entry.state !== PluginState.Running && entry.state !== PluginState.Initialized) {
      return; // Plugin not running
    }
    
    entry.state = PluginState.Stopping;
    
    try {
      if (entry.plugin.onStop) {
        await Promise.race([
          entry.plugin.onStop(),
          this.timeout(`Plugin ${name} onStop timeout`),
        ]);
      }
      
      entry.state = PluginState.Stopped;
      this.options.logger.debug(`Stopped plugin: ${name}`);
    } catch (error) {
      entry.state = PluginState.Error;
      entry.error = error instanceof Error ? error : new Error(String(error));
      
      // Still mark as stopped even on error
      this.options.logger.warn(`Error stopping plugin ${name}:`, entry.error);
    }
  }
  
  /**
   * Stop all plugins (in reverse init order)
   */
  async stopAll(): Promise<void> {
    const reversed = [...this.initOrder].reverse();
    for (const name of reversed) {
      await this.stopPlugin(name);
    }
  }
  
  /**
   * Health check all plugins
   */
  async healthCheck(): Promise<Map<string, {
    healthy: boolean;
    state: PluginState;
    details?: Record<string, unknown>;
    error?: string;
  }>> {
    const results = new Map();
    
    for (const [name, entry] of this.plugins) {
      let healthy = entry.state === PluginState.Running || entry.state === PluginState.Initialized;
      let details: Record<string, unknown> | undefined;
      let error: string | undefined;
      
      // Call plugin health check if available
      if (entry.plugin.onHealthCheck && healthy) {
        try {
          const result = await entry.plugin.onHealthCheck();
          healthy = result.healthy;
          details = result.details;
          error = result.error;
        } catch (e) {
          healthy = false;
          error = e instanceof Error ? e.message : String(e);
        }
      }
      
      results.set(name, {
        healthy,
        state: entry.state,
        details,
        error: error || entry.error?.message,
      });
    }
    
    return results;
  }
  
  /**
   * Get plugin state
   */
  getState(name: string): PluginState | null {
    return this.plugins.get(name)?.state ?? null;
  }
  
  /**
   * Get plugin API
   */
  getAPI(name: string): unknown | null {
    return this.plugins.get(name)?.api ?? null;
  }
  
  /**
   * Get all plugin entries
   */
  getAll(): Map<string, PluginLifecycleEntry> {
    return new Map(this.plugins);
  }
  
  /**
   * Sort plugins by dependencies (topological sort)
   */
  private sortByDependencies(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }
      
      visiting.add(name);
      
      const entry = this.plugins.get(name);
      if (entry?.plugin.manifest?.dependencies?.plugins) {
        for (const dep of entry.plugin.manifest.dependencies.plugins) {
          if (this.plugins.has(dep)) {
            visit(dep);
          }
        }
      }
      
      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };
    
    for (const name of this.plugins.keys()) {
      visit(name);
    }
    
    return result;
  }
  
  /**
   * Create timeout promise
   */
  private timeout(message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(message);
        (error as any).code = ErrorCodes.TIMEOUT;
        reject(error);
      }, this.options.timeout);
    });
  }
}

/**
 * Create a plugin lifecycle manager
 */
export function createLifecycleManager(
  options: LifecycleManagerOptions
): PluginLifecycleManager {
  return new PluginLifecycleManager(options);
}
