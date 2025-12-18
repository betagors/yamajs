/**
 * Plugin System Type Definitions
 * 
 * Core types for Yama's plugin system including:
 * - Plugin lifecycle hooks
 * - Migration definitions
 * - Directive support
 * - Schema-level plugin configuration ($$ blocks)
 */

// ============================================================================
// Directive Types for Plugins
// ============================================================================

/**
 * Directive target types
 */
export type PluginDirectiveTarget = 'field' | 'schema' | 'both';

/**
 * Directive arguments (parsed from directive syntax)
 */
export interface PluginDirectiveArgs {
  _value?: unknown;
  enabled?: boolean;
  values?: unknown[];
  [key: string]: unknown;
}

/**
 * Directive definition that plugins can register
 */
export interface PluginDirectiveDefinition {
  /** Where can this directive be used? */
  targets: PluginDirectiveTarget[];

  /** JSON Schema for argument validation */
  argsSchema?: Record<string, unknown>;

  /** Human-readable description */
  description?: string;

  /** Field-level hook - called when directive is applied to a field */
  onField?(context: {
    fieldName: string;
    fieldType: Record<string, unknown>;
    schemaName: string;
    args: PluginDirectiveArgs;
    meta: Record<string, unknown>;
    getSchema(): Record<string, unknown>;
  }): void | Promise<void>;

  /** Schema-level hook - called when directive is applied to a schema */
  onSchema?(context: {
    schemaName: string;
    schema: Record<string, unknown>;
    args: PluginDirectiveArgs;
    meta: Record<string, unknown>;
  }): void | Promise<void>;

  /** Transform hook - called during request processing */
  transform?(
    value: unknown,
    args: PluginDirectiveArgs,
    context: {
      fieldName: string;
      schemaName: string;
      operation: 'create' | 'update' | 'read';
      requestData: Record<string, unknown>;
    }
  ): unknown | Promise<unknown>;

  /** Validate hook - return true if valid, or error message */
  validate?(
    value: unknown,
    args: PluginDirectiveArgs,
    context: {
      fieldName: string;
      schemaName: string;
      operation: 'create' | 'update';
      requestData: Record<string, unknown>;
    }
  ): boolean | string | Promise<boolean | string>;
}

/**
 * JSON Schema for plugin's schema-level options (used in $$ blocks)
 */
export interface PluginSchemaOptionsSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Schema definition with plugin options (from $$ block)
 */
export interface SchemaWithPluginOptions {
  /** Schema name */
  name: string;

  /** Field definitions */
  fields: Record<string, unknown>;

  /** Plugin configurations from $$ block, keyed by plugin name */
  pluginOptions?: Record<string, Record<string, unknown>>;

  /** Computed fields */
  computed?: Record<string, unknown>;

  /** Schema variants */
  variants?: Record<string, unknown>;

  /** Database configuration */
  database?: Record<string, unknown>;
}

// ============================================================================
// Plugin Migration Definition
// ============================================================================

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

  /**
   * [NEW] Required plugins that must be installed before this migration runs
   * Used for cross-plugin migration dependencies
   */
  requires?: Array<{
    /** Plugin name (e.g., "@yamajs/plugin-clerk") */
    plugin: string;
    /** Minimum version required (semver) */
    version: string;
  }>;
}

/**
 * Plugin dependencies
 */
export interface PluginDependencies {
  /**
   * Core version requirement - semver range (e.g., "^0.1.0")
   */
  core?: string;
}

/**
 * Plugin dependency relationship types
 */
export interface PluginRelationships {
  /**
   * Required plugins - must be loaded before this plugin
   * If missing, plugin loading will fail with clear error
   */
  requires?: string[];

  /**
   * Optional plugins - used if available, gracefully ignored if not
   * Plugin can check for their presence at runtime
   */
  optional?: string[];

  /**
   * Conflicting plugins - cannot be loaded together
   * If both are present, loading will fail with clear error
   */
  conflicts?: string[];
}

/**
 * Plugin manifest metadata from package.json (optional)
 */
export interface PluginManifest {
  pluginApi?: string; // Plugin API version (e.g., "1.0")
  yamaCore?: string; // Compatible Yama core version (e.g., "^0.1.0")
  category?: string; // Plugin category (e.g., "database", "payments", "email")
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

  /**
   * [NEW] Table access policy for sandbox enforcement
   * Controls which database tables this plugin can access
   */
  tablePolicy?: {
    /** Policy mode: strict = deny by default, permissive = allow by default */
    mode?: "strict" | "permissive";
    /** Allowed table prefixes (e.g., ["stripe_", "payment_"]) */
    allowedPrefixes?: string[];
    /** Explicitly allowed tables (e.g., ["users"]) */
    allowedTables?: string[];
    /** Tables shared across multiple plugins */
    sharedTables?: string[];
  };

  [key: string]: unknown; // Allow additional metadata
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  /**
   * [NEW] Called after ALL plugins have been initialized
   * This is the safe place to interact with other plugins
   * Runs in dependency order (dependents run after their dependencies)
   * 
   * @param context - Plugin context with access to all initialized plugins
   */
  onReady?(context: PluginContext): Promise<void> | void;

  /**
   * [NEW] Called during graceful shutdown
   * Runs in reverse dependency order (dependents shut down before dependencies)
   * Use for cleanup: close connections, flush buffers, etc.
   * 
   * @param context - Plugin context
   */
  onShutdown?(context: PluginContext): Promise<void> | void;

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
   * [ENHANCED] Health check hook - called to verify plugin is healthy
   * Used by /health endpoint for Kubernetes/Docker readiness probes
   * 
   * @returns Health status with details
   */
  onHealthCheck?(): Promise<{
    healthy: boolean;
    latency?: number;
    details?: Record<string, unknown>;
    error?: string;
  }> | {
    healthy: boolean;
    latency?: number;
    details?: Record<string, unknown>;
    error?: string;
  };
}

/**
 * Future-proof plugin interface
 * Plugins implement this interface and return their API from init()
 */
export interface YamaPlugin extends PluginLifecycle, PluginRelationships {
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
   * [NEW] Human-readable description of what this plugin does
   */
  description?: string;

  /**
   * [NEW] Plugin author or maintainer
   */
  author?: string;

  /**
   * [NEW] Repository URL
   */
  repository?: string;

  /**
   * [NEW] Directives this plugin provides
   * Map of directive name (with @) to directive definition
   * 
   * @example
   * ```typescript
   * directives: {
   *   '@searchable': {
   *     targets: ['field'],
   *     description: 'Marks field for full-text search',
   *     onField({ fieldType, args, meta }) {
   *       meta.searchable = true;
   *       meta.searchWeight = args.weight ?? 1;
   *     }
   *   }
   * }
   * ```
   */
  directives?: Record<string, PluginDirectiveDefinition>;

  /**
   * [NEW] Schema-level options this plugin accepts (for $$ block)
   * JSON Schema that validates plugin configuration in schema $$ blocks
   * 
   * @example
   * ```typescript
   * schemaOptions: {
   *   type: 'object',
   *   properties: {
   *     index: { type: 'boolean', default: false },
   *     filterable: { type: 'array', items: { type: 'string' } }
   *   }
   * }
   * ```
   */
  schemaOptions?: PluginSchemaOptionsSchema;

  /**
   * [NEW] Called after all schemas have been loaded, with $$ configs
   * Runs in dependency order, after all plugins are initialized
   * 
   * @param schemas - All parsed schemas with their $$ configurations
   * @param context - Plugin context
   */
  onSchemaLoaded?(
    schemas: Record<string, SchemaWithPluginOptions>,
    context: PluginContext
  ): void | Promise<void>;

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

