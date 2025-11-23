/**
 * Plugin manifest metadata from package.json (optional)
 */
export interface PluginManifest {
  pluginApi?: string; // Plugin API version (e.g., "1.0")
  yamaCore?: string; // Compatible Yama core version (e.g., "^0.1.0")
  category?: string; // Plugin category (e.g., "database", "payments", "email")
  type?: string; // Service type (e.g., "payment", "email", "sms")
  service?: string; // Specific service name (e.g., "stripe", "sendgrid")
  entryPoint?: string; // Entry point file (default: "./dist/plugin.js")
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
   * Initialize the plugin with configuration
   * Returns the plugin API that will be exposed to users
   */
  init(opts?: Record<string, unknown>): Promise<any>;
}

/**
 * @deprecated Use YamaPlugin instead
 * Base service plugin interface (kept for backward compatibility)
 */
export interface ServicePlugin extends PluginLifecycle {
  /**
   * Plugin name (package name)
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Plugin manifest
   */
  manifest: PluginManifest;

  /**
   * Initialize the plugin with configuration
   */
  init(config: Record<string, unknown>): Promise<void> | void;
}

/**
 * Plugin context passed to plugins
 */
export interface PluginContext {
  config: Record<string, unknown>;
  logger?: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
  [key: string]: unknown;
}

