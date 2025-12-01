/**
 * Simple event emitter implementation
 */
class SimpleEventEmitter {
    constructor() {
        this.listeners = new Map();
    }
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
    }
    off(event, handler) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    once(event, handler) {
        const onceHandler = (...args) => {
            handler(...args);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }
    emit(event, data) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(data);
                }
                catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
}
/**
 * Service registry for plugin services
 */
class ServiceRegistry {
    constructor() {
        this.services = new Map();
    }
    register(name, service) {
        this.services.set(name, service);
    }
    get(name) {
        return this.services.get(name);
    }
    has(name) {
        return this.services.has(name);
    }
    getAll() {
        return new Map(this.services);
    }
    clear() {
        this.services.clear();
    }
}
/**
 * CLI command registry for plugin commands
 */
class CLICommandRegistry {
    constructor() {
        this.commands = new Map();
    }
    register(command) {
        this.commands.set(command.name, command);
    }
    get(name) {
        return this.commands.get(name);
    }
    getAll() {
        return Array.from(this.commands.values());
    }
    clear() {
        this.commands.clear();
    }
}
/**
 * MCP tool registry for plugin tools
 */
class MCPToolRegistry {
    constructor() {
        this.tools = new Map();
    }
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    get(name) {
        return this.tools.get(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    clear() {
        this.tools.clear();
    }
}
/**
 * Plugin context implementation
 */
export class PluginContextImpl {
    constructor(config, projectDir, logger, pluginRegistry, pluginAPIs, middlewareRegistry) {
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
    getPlugin(name) {
        return this.pluginRegistry.get(name) || null;
    }
    /**
     * Get plugin API (returned from init())
     */
    getPluginAPI(name) {
        return this.pluginAPIs.get(name) || null;
    }
    /**
     * Get all plugins by category
     */
    getPluginsByCategory(category) {
        return Array.from(this.pluginRegistry.values()).filter((plugin) => plugin.category === category);
    }
    /**
     * Register a service
     */
    registerService(name, service) {
        this.serviceRegistry.register(name, service);
        this.emit("service:registered", { name, service });
    }
    /**
     * Get a service by name
     */
    getService(name) {
        return this.serviceRegistry.get(name);
    }
    /**
     * Check if a service exists
     */
    hasService(name) {
        return this.serviceRegistry.has(name);
    }
    /**
     * Get middleware registry to register middleware
     */
    getMiddlewareRegistry() {
        if (!this.middlewareRegistry) {
            throw new Error("Middleware registry is not available. Middleware registry must be provided when creating PluginContext.");
        }
        return this.middlewareRegistry;
    }
    /**
     * Emit an event
     */
    emit(event, data) {
        this.eventEmitter.emit(event, data);
    }
    /**
     * Listen to an event
     */
    on(event, handler) {
        this.eventEmitter.on(event, handler);
    }
    /**
     * Remove event listener
     */
    off(event, handler) {
        this.eventEmitter.off(event, handler);
    }
    /**
     * Listen to an event once
     */
    once(event, handler) {
        this.eventEmitter.once(event, handler);
    }
    /**
     * Register a CLI command
     */
    registerCLICommand(command) {
        this.cliCommandRegistry.register(command);
        this.emit("cli:command:registered", { command });
        this.logger.debug(`Registered CLI command: ${command.name}`);
    }
    /**
     * Get all registered CLI commands
     */
    getCLICommands() {
        return this.cliCommandRegistry.getAll();
    }
    /**
     * Get a CLI command by name
     */
    getCLICommand(name) {
        return this.cliCommandRegistry.get(name);
    }
    /**
     * Register an MCP tool
     */
    registerMCPTool(tool) {
        this.mcpToolRegistry.register(tool);
        this.emit("mcp:tool:registered", { tool });
        this.logger.debug(`Registered MCP tool: ${tool.name}`);
    }
    /**
     * Get all registered MCP tools
     */
    getMCPTools() {
        return this.mcpToolRegistry.getAll();
    }
    /**
     * Get an MCP tool by name
     */
    getMCPTool(name) {
        return this.mcpToolRegistry.get(name);
    }
}
//# sourceMappingURL=context.js.map