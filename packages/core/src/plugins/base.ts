/**
 * Plugin migration definition
 */
export interface PluginMigrationDefinition {
  /**
   * Migration up script - can be a file path (relative to plugin package) or a function
   */
  up: string | (() => Promise<void> | void);
  
  /**
   * Migration down script for rollback (optional)
   */
  down?: string | (() => Promise<void> | void);
  
  /**
   * Migration type: 'schema' (database changes), 'config' (configuration changes), or 'data' (data transformations)
   */
  type?: 'schema' | 'config' | 'data';
  
  /**
   * Description of what this migration does
   */
  description?: string;
}

/**
 * Plugin dependencies
 */
export interface PluginDependencies {
  /**
   * Plugin dependencies - list of plugin package names this plugin requires
   */
  plugins?: string[];
  
  /**
   * Core version requirement - semver range (e.g., "^0.1.0")
   */
  core?: string;
}

/**
 * Plugin manifest metadata from package.json (optional)
 */
export interface PluginManifest {
  pluginApi?: string; // Plugin API version (e.g., "1.0")
  yamaCore?: string; // Compatible Yama core version (e.g., "^0.1.0")
  category?: string; // Plugin category (e.g., "database", "payments", "email")
  type?: string; // Service type (e.g., "payment", "email", "sms")
  service?: string; // Specific service name (e.g., "stripe", "sendgrid")
  entryPoint?: string; // Entry point file (default: "./dist/plugin.ts")
  
  /**
   * Plugin dependencies
   */
  dependencies?: PluginDependencies;
  
  /**
   * Plugin migrations - maps version strings to migration definitions
   * Versions should be semver-compatible (e.g., "1.0.0", "1.1.0")
   */
  migrations?: Record<string, PluginMigrationDefinition>;
  
  /**
   * Initial schema for plugins that create tables
   * Can be a file path (relative to plugin package) or a function that returns SQL
   */
  initialSchema?: string | (() => Promise<string> | string);
  
  /**
   * JSON Schema for plugin configuration validation
   */
  configSchema?: Record<string, unknown>;
  
  /**
   * Security policy for the plugin
   */
  security?: {
    requiresCodeSigning?: boolean;
    allowedAPIs?: string[];
    sandboxed?: boolean;
    trustedPublisher?: string;
  };
  
  [key: string]: unknown; // Allow additional metadata
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  /**
   * Called when plugin is initialized
   */
  onInit?(config: Record<string, unknown>): Promise<void> | void;

  /**
   * Called when plugin is started
   */
  onStart?(): Promise<void> | void;

  /**
   * Called when plugin is stopped
   */
  onStop?(): Promise<void> | void;

  /**
   * Called when an error occurs
   */
  onError?(error: Error): void;

  /**
   * Called before a plugin migration runs
   * @param fromVersion - Version migrating from
   * @param toVersion - Version migrating to
   */
  onBeforeMigrate?(fromVersion: string, toVersion: string): Promise<void> | void;

  /**
   * Called after a plugin migration completes successfully
   * @param fromVersion - Version migrated from
   * @param toVersion - Version migrated to
   */
  onAfterMigrate?(fromVersion: string, toVersion: string): Promise<void> | void;

  /**
   * Called if a plugin migration fails (for cleanup)
   * @param error - The error that occurred
   * @param fromVersion - Version migrating from
   * @param toVersion - Version migrating to
   */
  onMigrationError?(error: Error, fromVersion: string, toVersion: string): Promise<void> | void;

  /**
   * Health check hook - called to verify plugin is healthy
   * @returns Health status with details
   */
  onHealthCheck?(): Promise<{
    healthy: boolean;
    details?: Record<string, unknown>;
    error?: string;
  }> | {
    healthy: boolean;
    details?: Record<string, unknown>;
    error?: string;
  };
}

/**
 * Future-proof plugin interface
 * Plugins implement this interface and return their API from init()
 */
export interface YamaPlugin extends PluginLifecycle {
  /**
   * Plugin name (package name)
   */
  name: string;

  /**
   * Plugin version (optional but recommended)
   */
  version?: string;

  /**
   * Plugin category (optional, e.g., "database", "payments", "email")
   */
  category?: string;

  /**
   * Plugin API version (optional but recommended)
   */
  pluginApi?: string;

  /**
   * Compatible Yama core version (optional but recommended)
   */
  yamaCore?: string;

  /**
   * Plugin manifest (optional, can be inferred from package.json)
   */
  manifest?: PluginManifest;

  /**
   * Initialize the plugin with configuration and context
   * @param opts - Plugin configuration options
   * @param context - Plugin context (required)
   * Returns the plugin API that will be exposed to users
   */
  init(opts: Record<string, unknown>, context: PluginContext): Promise<any>;
}


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
 * CLI command option definition
 */
export interface PluginCLICommandOption {
  flags: string;
  description: string;
  defaultValue?: any;
  required?: boolean;
}

/**
 * CLI command definition for plugins
 */
export interface PluginCLICommand {
  /**
   * Command name (e.g., "docker generate" or "ci write")
   * Can be a single word or space-separated for nested commands
   */
  name: string;
  
  /**
   * Command description
   */
  description: string;
  
  /**
   * Command options/flags
   */
  options?: PluginCLICommandOption[];
  
  /**
   * Command action handler
   */
  action: (options: Record<string, any>) => Promise<void> | void;
  
  /**
   * Plugin name that registered this command (for namespacing)
   */
  pluginName?: string;
}

/**
 * MCP tool result content
 */
export interface MCPToolResultContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

/**
 * MCP tool result
 */
export interface MCPToolResult {
  content: MCPToolResultContent[];
  isError?: boolean;
}

/**
 * MCP tool definition for plugins
 */
export interface PluginMCPTool {
  /**
   * Tool name (should be namespaced, e.g., "yama_docker_generate")
   */
  name: string;
  
  /**
   * Tool description
   */
  description: string;
  
  /**
   * Input schema (Zod schema)
   */
  inputSchema: any; // Using any to avoid requiring zod as a dependency in core
  
  /**
   * Tool handler function
   */
  handler: (args: any) => Promise<MCPToolResult>;
  
  /**
   * Plugin name that registered this tool (for namespacing)
   */
  pluginName?: string;
}

/**
 * Plugin context passed to plugins
 * Provides access to other plugins, services, events, and runtime information
 */
export interface PluginContext {
  /**
   * Full Yama configuration
   */
  config: Record<string, unknown>;
  
  /**
   * Project directory path
   */
  projectDir: string;
  
  /**
   * Logger instance for plugin logging
   */
  logger: Logger;
  
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
   * Register a service that other plugins can access
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
  getMiddlewareRegistry(): import("../middleware/registry.js").MiddlewareRegistry;
  
  /**
   * Register a CLI command that will be available in the Yama CLI
   */
  registerCLICommand(command: PluginCLICommand): void;
  
  /**
   * Register an MCP tool that will be available in the MCP server
   */
  registerMCPTool(tool: PluginMCPTool): void;
  
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
}

