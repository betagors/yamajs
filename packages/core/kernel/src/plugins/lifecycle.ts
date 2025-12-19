/**
 * @yamajs/core - Plugin Lifecycle Manager
 * 
 * Standardized plugin lifecycle management with proper
 * initialization, validation, and error handling.
 */

import type { YamaPlugin, PluginContext, PluginManifest } from "../../../../../../../../core/kernel/src/plugins/base.js";
import { validateYamaPlugin, validatePluginConfig, validatePluginVersion } from "../../../../../../../../core/kernel/src/plugins/validator.js";
import { ErrorCodes } from "@yamajs/errors";
import { getRuntime } from "../../../../../../../../core/kernel/src/platform/index.js";

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
  /** [NEW] Plugin is ready (all plugins initialized, onReady complete) */
  Ready = "ready",
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
        debug: () => { },
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
   * [NEW] Call onReady on all plugins after ALL are initialized
   * 
   * This is the safe point to interact with other plugins.
   * Runs in dependency order (dependencies ready before dependents).
   * 
   * @param context - Plugin context to pass to onReady hooks
   */
  async readyAll(context: PluginContext): Promise<{
    success: boolean;
    errors: Array<{ plugin: string; error: Error }>;
  }> {
    const errors: Array<{ plugin: string; error: Error }> = [];

    for (const name of this.initOrder) {
      const entry = this.plugins.get(name);
      if (!entry) continue;

      // Only call onReady on initialized/running plugins
      if (entry.state !== PluginState.Initialized &&
        entry.state !== PluginState.Running) {
        continue;
      }

      if (entry.plugin.onReady) {
        try {
          await Promise.race([
            entry.plugin.onReady(context),
            this.timeout(`Plugin ${name} onReady timeout`),
          ]);
          entry.state = PluginState.Ready;
          this.options.logger.debug(`Plugin ready: ${name}`);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push({ plugin: name, error: err });

          if (entry.plugin.onError) {
            try {
              entry.plugin.onError(err);
            } catch {
              // Ignore
            }
          }

          this.options.logger.warn(`Plugin ${name} onReady failed:`, err.message);

          if (this.options.failFast) {
            throw err;
          }
        }
      } else {
        // No onReady hook, mark as ready anyway
        entry.state = PluginState.Ready;
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Stop a plugin
   */
  async stopPlugin(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) {
      return; // Plugin not registered, nothing to stop
    }

    if (entry.state !== PluginState.Running &&
      entry.state !== PluginState.Initialized &&
      entry.state !== PluginState.Ready) {
      return; // Plugin not running
    }

    entry.state = PluginState.Stopping;

    try {
      // Use onShutdown
      if (entry.plugin.onShutdown) {
        const context = this.createMinimalContext(name);
        await Promise.race([
          entry.plugin.onShutdown(context),
          this.timeout(`Plugin ${name} onShutdown timeout`),
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
   * 
   * [ENHANCED] Dependents shut down before their dependencies.
   * Supports new onShutdown hook for graceful cleanup.
   */
  async stopAll(): Promise<{
    success: boolean;
    errors: Array<{ plugin: string; error: Error }>;
  }> {
    const errors: Array<{ plugin: string; error: Error }> = [];
    const reversed = [...this.initOrder].reverse();

    for (const name of reversed) {
      try {
        await this.stopPlugin(name);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ plugin: name, error: err });
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Create minimal context for shutdown (doesn't need full context)
   */
  private createMinimalContext(pluginName: string): PluginContext {
    return {
      config: {},
      projectDir: getRuntime().env.cwd(),
      logger: this.options.logger,
      getPlugin: (name: string) => this.plugins.get(name)?.plugin ?? null,
      getPluginAPI: (name: string) => this.plugins.get(name)?.api ?? null,
      getPluginsByCategory: () => [],
      registerService: () => { },
      getService: () => null,
      hasService: () => false,
      getMiddlewareRegistry: () => { throw new Error("Middleware not available during shutdown"); },
      registerCLICommand: () => { },
      registerMCPTool: () => { },
      emit: () => { },
      on: () => { },
      off: () => { },
      once: () => { },
    };
  }


  /**
   * Health check all plugins
   * 
   * [ENHANCED] Now includes latency tracking for Kubernetes probes
   */
  async healthCheck(): Promise<Map<string, {
    healthy: boolean;
    state: PluginState;
    latency?: number;
    details?: Record<string, unknown>;
    error?: string;
  }>> {
    const results = new Map();

    for (const [name, entry] of this.plugins) {
      let healthy = entry.state === PluginState.Running ||
        entry.state === PluginState.Initialized ||
        entry.state === PluginState.Ready;
      let details: Record<string, unknown> | undefined;
      let error: string | undefined;
      let latency: number | undefined;

      // Call plugin health check if available
      if (entry.plugin.onHealthCheck && healthy) {
        try {
          const start = Date.now();
          const result = await entry.plugin.onHealthCheck();
          latency = result.latency ?? (Date.now() - start);
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
        latency,
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
      if (entry?.plugin.requires) {
        for (const dep of entry.plugin.requires) {
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

/**
 * [DEPRECATED] Register graceful shutdown handlers
 * 
 * Signal handling (SIGTERM/SIGINT) is runtime-specific and must be handled
 * by the runtime adapter (e.g., @yamajs/runtime-node).
 * 
 * This function is kept for API compatibility but does nothing.
 * Use your runtime's shutdown registration instead:
 * 
 * @example
 * // In @yamajs/runtime-node:
 * import { registerNodeShutdown } from "@yamajs/runtime-node";
 * registerNodeShutdown(manager.stopAll.bind(manager));
 * 
 * @param manager - The lifecycle manager (unused)
 * @param options - Shutdown options (unused)
 */
export function registerGracefulShutdown(
  _manager: PluginLifecycleManager,
  _options: {
    timeout?: number;
    logger?: {
      log(message: string, ...args: unknown[]): void;
      error(message: string, ...args: unknown[]): void;
    };
  } = {}
): void {
  // No-op in kernel. Signal handling must be done by runtime adapters.
  // See @yamajs/runtime-node for the Node.js implementation.
}

/**
 * [NEW] Aggregate health check result
 * 
 * Useful for /health endpoint responses
 */
export interface AggregatedHealthResult {
  healthy: boolean;
  timestamp: string;
  plugins: Record<string, {
    healthy: boolean;
    state: PluginState;
    latency?: number;
    error?: string;
  }>;
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
}

/**
 * [NEW] Convert health check map to aggregated result
 */
export function aggregateHealthCheck(
  healthMap: Map<string, {
    healthy: boolean;
    state: PluginState;
    latency?: number;
    details?: Record<string, unknown>;
    error?: string;
  }>
): AggregatedHealthResult {
  const plugins: AggregatedHealthResult["plugins"] = {};
  let healthyCount = 0;
  let unhealthyCount = 0;

  for (const [name, result] of healthMap) {
    plugins[name] = {
      healthy: result.healthy,
      state: result.state,
      latency: result.latency,
      error: result.error,
    };

    if (result.healthy) {
      healthyCount++;
    } else {
      unhealthyCount++;
    }
  }

  return {
    healthy: unhealthyCount === 0,
    timestamp: new Date().toISOString(),
    plugins,
    summary: {
      total: healthMap.size,
      healthy: healthyCount,
      unhealthy: unhealthyCount,
    },
  };
}
