import type { YamaPlugin, PluginManifest, PluginCLICommand, PluginMCPTool } from "./base.js";
import type { EventEmitter } from "events";
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
 * Simple event emitter implementation
 */
class SimpleEventEmitter {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  once(event: string, handler: Function): void {
    const onceHandler = (...args: any[]) => {
      handler(...args);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  emit(event: string, data?: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

/**
 * Service registry for plugin services
 */
class ServiceRegistry {
  private services = new Map<string, any>();

  register(name: string, service: any): void {
    this.services.set(name, service);
  }

  get(name: string): any {
    return this.services.get(name);
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  getAll(): Map<string, any> {
    return new Map(this.services);
  }

  clear(): void {
    this.services.clear();
  }
}

/**
 * CLI command registry for plugin commands
 */
class CLICommandRegistry {
  private commands = new Map<string, PluginCLICommand>();

  register(command: PluginCLICommand): void {
    this.commands.set(command.name, command);
  }

  get(name: string): PluginCLICommand | undefined {
    return this.commands.get(name);
  }

  getAll(): PluginCLICommand[] {
    return Array.from(this.commands.values());
  }

  clear(): void {
    this.commands.clear();
  }
}

/**
 * MCP tool registry for plugin tools
 */
class MCPToolRegistry {
  private tools = new Map<string, PluginMCPTool>();

  register(tool: PluginMCPTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): PluginMCPTool | undefined {
    return this.tools.get(name);
  }

  getAll(): PluginMCPTool[] {
    return Array.from(this.tools.values());
  }

  clear(): void {
    this.tools.clear();
  }
}

/**
 * Plugin context implementation
 */
export class PluginContextImpl {
  public readonly config: Record<string, unknown>;
  public readonly projectDir: string;
  public readonly logger: Logger;
  private pluginRegistry: Map<string, YamaPlugin>;
  private pluginAPIs: Map<string, any>;
  private eventEmitter: SimpleEventEmitter;
  private serviceRegistry: ServiceRegistry;
  private cliCommandRegistry: CLICommandRegistry;
  private mcpToolRegistry: MCPToolRegistry;
  private middlewareRegistry: MiddlewareRegistry | null;

  constructor(
    config: Record<string, unknown>,
    projectDir: string,
    logger: Logger,
    pluginRegistry: Map<string, YamaPlugin>,
    pluginAPIs: Map<string, any>,
    middlewareRegistry?: MiddlewareRegistry | null
  ) {
    this.config = config;
    this.projectDir = projectDir;
    this.logger = logger;
    this.pluginRegistry = pluginRegistry;
    this.pluginAPIs = pluginAPIs;
    this.eventEmitter = new SimpleEventEmitter();
    this.serviceRegistry = new ServiceRegistry();
    this.cliCommandRegistry = new CLICommandRegistry();
    this.mcpToolRegistry = new MCPToolRegistry();
    this.middlewareRegistry = middlewareRegistry || null;
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name: string): YamaPlugin | null {
    return this.pluginRegistry.get(name) || null;
  }

  /**
   * Get plugin API (returned from init())
   */
  getPluginAPI(name: string): any {
    return this.pluginAPIs.get(name) || null;
  }

  /**
   * Get all plugins by category
   */
  getPluginsByCategory(category: string): YamaPlugin[] {
    return Array.from(this.pluginRegistry.values()).filter(
      (plugin) => plugin.category === category
    );
  }

  /**
   * Register a service
   */
  registerService(name: string, service: any): void {
    this.serviceRegistry.register(name, service);
    this.emit("service:registered", { name, service });
  }

  /**
   * Get a service by name
   */
  getService(name: string): any {
    return this.serviceRegistry.get(name);
  }

  /**
   * Check if a service exists
   */
  hasService(name: string): boolean {
    return this.serviceRegistry.has(name);
  }

  /**
   * Get middleware registry to register middleware
   */
  getMiddlewareRegistry(): MiddlewareRegistry {
    if (!this.middlewareRegistry) {
      throw new Error(
        "Middleware registry is not available. Middleware registry must be provided when creating PluginContext."
      );
    }
    return this.middlewareRegistry;
  }

  /**
   * Emit an event
   */
  emit(event: string, data?: any): void {
    this.eventEmitter.emit(event, data);
  }

  /**
   * Listen to an event
   */
  on(event: string, handler: Function): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: Function): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Listen to an event once
   */
  once(event: string, handler: Function): void {
    this.eventEmitter.once(event, handler);
  }

  /**
   * Register a CLI command
   */
  registerCLICommand(command: PluginCLICommand): void {
    this.cliCommandRegistry.register(command);
    this.emit("cli:command:registered", { command });
    this.logger.debug(`Registered CLI command: ${command.name}`);
  }

  /**
   * Get all registered CLI commands
   */
  getCLICommands(): PluginCLICommand[] {
    return this.cliCommandRegistry.getAll();
  }

  /**
   * Get a CLI command by name
   */
  getCLICommand(name: string): PluginCLICommand | undefined {
    return this.cliCommandRegistry.get(name);
  }

  /**
   * Register an MCP tool
   */
  registerMCPTool(tool: PluginMCPTool): void {
    this.mcpToolRegistry.register(tool);
    this.emit("mcp:tool:registered", { tool });
    this.logger.debug(`Registered MCP tool: ${tool.name}`);
  }

  /**
   * Get all registered MCP tools
   */
  getMCPTools(): PluginMCPTool[] {
    return this.mcpToolRegistry.getAll();
  }

  /**
   * Get an MCP tool by name
   */
  getMCPTool(name: string): PluginMCPTool | undefined {
    return this.mcpToolRegistry.get(name);
  }
}

