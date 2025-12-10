import type { YamaPlugin, PluginManifest, PluginContext, Logger } from "./base.js";
import { loadPluginFromPackage, importPlugin } from "./loader.js";
import { validateYamaPlugin, validatePluginVersion } from "./validator.js";
import {
  ensurePluginMigrationTables,
  getInstalledPluginVersion,
  getPendingPluginMigrations,
  executePluginMigration,
  updatePluginVersion,
  getPluginPackageDir,
} from "./migrations.js";
import { PluginContextImpl } from "./context.js";
import {
  resolvePluginDependencies,
  validateDependencies,
} from "./dependencies.js";
import {
  trackPluginLoad,
  recordPluginLoaded,
  trackPluginInit,
  recordPluginInitialized,
  recordPluginError,
} from "./metrics.js";
import type { MiddlewareRegistry } from "../middleware/registry.js";

/**
 * Plugin registry
 */
export class PluginRegistry {
  private plugins = new Map<string, YamaPlugin>();
  private manifests = new Map<string, PluginManifest>();
  private packageDirs = new Map<string, string>();
  private pluginAPIs = new Map<string, any>();
  private pluginContexts = new Map<string, PluginContext>();
  private config: Record<string, unknown> = {};
  private projectDir: string = process.cwd();
  private logger: Logger | null = null;
  private middlewareRegistry: MiddlewareRegistry | null = null;

  /**
   * Get database connection from database plugin if available
   */
  private async getDatabaseConnection(): Promise<{ sql: any } | null> {
    const dbPlugin = this.getPluginByCategory("database");
    if (!dbPlugin) {
      return null;
    }

    try {
      // Try to get SQL client from already initialized plugin API
      const pluginApi = this.pluginAPIs.get(dbPlugin.name);
      if (
        pluginApi &&
        typeof pluginApi === "object" &&
        "client" in pluginApi &&
        pluginApi.client &&
        typeof pluginApi.client === "object" &&
        "getSQL" in pluginApi.client &&
        typeof pluginApi.client.getSQL === "function"
      ) {
        const sql = pluginApi.client.getSQL();
        if (sql) {
          return { sql };
        }
      }
    } catch (error) {
      // Database not initialized yet, that's okay
      return null;
    }

    return null;
  }

  /**
   * Set registry configuration
   */
  setConfig(config: Record<string, unknown>, projectDir: string, logger?: Logger): void {
    this.config = config;
    this.projectDir = projectDir;
    this.logger = logger || this.createDefaultLogger();
  }

  /**
   * Set middleware registry (called by runtime after creating middleware registry)
   */
  setMiddlewareRegistry(middlewareRegistry: MiddlewareRegistry): void {
    this.middlewareRegistry = middlewareRegistry;
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[DEBUG] ${message}`, ...args);
        }
      },
    };
  }

  /**
   * Create plugin context
   */
  private createContext(): PluginContext {
    if (!this.logger) {
      this.logger = this.createDefaultLogger();
    }
    return new PluginContextImpl(
      this.config,
      this.projectDir,
      this.logger,
      this.plugins,
      this.pluginAPIs,
      this.middlewareRegistry
    );
  }

  /**
   * Load and register a plugin
   * @param packageName - Name of the package to load
   * @param projectDir - Optional project directory to resolve packages from
   * @param pluginConfig - Plugin configuration options
   * @param skipDependencies - Skip dependency loading (for internal use)
   */
  async loadPlugin(
    packageName: string,
    projectDir?: string,
    pluginConfig: Record<string, unknown> = {},
    skipDependencies = false
  ): Promise<YamaPlugin> {
    // Check if already loaded
    if (this.plugins.has(packageName)) {
      return this.plugins.get(packageName)!;
    }

    // Load manifest
    const manifest = await loadPluginFromPackage(packageName, projectDir);

    // Load dependencies first (unless skipped)
    if (!skipDependencies && manifest.dependencies?.plugins) {
      const dependencies = manifest.dependencies.plugins;
      for (const dep of dependencies) {
        // Check if dependency is already loaded
        if (!this.plugins.has(dep)) {
          // Load dependency recursively (without its dependencies to avoid infinite loops)
          // Dependencies will be loaded in correct order by resolvePluginDependencies
          await this.loadPlugin(dep, projectDir, {}, true);
        }
      }

      // Validate all dependencies are loaded
      const loadedPluginNames = new Set(this.plugins.keys());
      const validation = validateDependencies(packageName, manifest, loadedPluginNames);
      if (!validation.valid) {
        throw new Error(
          `Plugin ${packageName} has unsatisfied dependencies: ${validation.missing.join(", ")}`
        );
      }
    }

    // Import plugin
    const plugin = await importPlugin(manifest, packageName, projectDir);

    // Validate plugin
    const validation = validateYamaPlugin(plugin);
    if (!validation.valid) {
      throw new Error(
        `Invalid plugin ${packageName}: ${validation.errors?.join(", ")}`
      );
    }

    // Validate version compatibility
    const versionValidation = validatePluginVersion(plugin, "0.1.0"); // TODO: Get actual core version
    if (versionValidation.errors && versionValidation.errors.length > 0) {
      console.warn(
        `Plugin ${packageName} version compatibility warning: ${versionValidation.errors.join(", ")}`
      );
    }

    // Store package directory for migration file resolution
    try {
      const packageDir = await getPluginPackageDir(packageName, projectDir);
      this.packageDirs.set(packageName, packageDir);
    } catch (error) {
      // If we can't get package dir, migrations won't work, but plugin can still load
      console.warn(
        `Could not resolve package directory for ${packageName}, migrations may not work: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Validate security policy
    if (manifest.security) {
      const { validateSecurityPolicy, getSecurityWarnings } = await import("./security.js");
      const securityValidation = validateSecurityPolicy(manifest);
      const warnings = getSecurityWarnings(manifest);
      
      if (securityValidation.warnings.length > 0 || warnings.length > 0) {
        for (const warning of [...securityValidation.warnings, ...warnings]) {
          console.warn(`⚠️  Security warning for ${packageName}: ${warning}`);
        }
      }
      
      if (securityValidation.errors.length > 0) {
        throw new Error(
          `Security validation failed for plugin ${packageName}: ${securityValidation.errors.join(", ")}`
        );
      }
    }

    // Validate plugin configuration if schema is provided
    if (manifest.configSchema && pluginConfig) {
      const { validatePluginConfig } = await import("./validator.js");
      const configValidation = validatePluginConfig(pluginConfig, manifest);
      if (!configValidation.valid) {
        throw new Error(
          `Invalid configuration for plugin ${packageName}: ${configValidation.errors?.join(", ")}`
        );
      }
    }

    // Register plugin (before init so it's available in context)
    this.plugins.set(packageName, plugin);
    this.manifests.set(packageName, manifest);

    // Create context
    const pluginContext = this.createContext();
    
    // Store context for later access to commands and tools
    this.pluginContexts.set(packageName, pluginContext);

    // Initialize plugin with config and context
    // Store the API returned from init()
    try {
      trackPluginInit(packageName);
      let pluginApi = await plugin.init(pluginConfig, pluginContext);
      recordPluginInitialized(packageName);
      
      // Auto-instrument plugin API if metrics service is available
      const metricsService = pluginContext.getService("metrics");
      if (metricsService && typeof metricsService.autoInstrument === "function") {
        pluginApi = metricsService.autoInstrument(packageName, pluginApi);
      }
      
      this.pluginAPIs.set(packageName, pluginApi);
      
      // Emit plugin loaded event
      pluginContext.emit("plugin:loaded", { name: packageName, plugin, api: pluginApi });
    } catch (error) {
      // Record error
      const err = error instanceof Error ? error : new Error(String(error));
      recordPluginError(packageName, err);
      
      // If init fails, still keep plugin registered but mark API as null
      this.pluginAPIs.set(packageName, null);
      pluginContext.emit("plugin:error", { name: packageName, error: err });
      throw error;
    }

    // Run plugin migrations if database is available
    if (manifest.migrations && Object.keys(manifest.migrations).length > 0) {
      try {
        const dbConnection = await this.getDatabaseConnection();
        if (dbConnection) {
          const { sql } = dbConnection;
          
          // Ensure migration tables exist
          await ensurePluginMigrationTables(sql);
          
          // Get current installed version
          const installedVersion = await getInstalledPluginVersion(
            packageName,
            sql
          );
          
          // Get plugin version
          const currentVersion = plugin.version || "0.0.0";
          
          // Get pending migrations
          const pending = await getPendingPluginMigrations(
            plugin,
            manifest,
            installedVersion,
            currentVersion
          );
          
          // Execute migrations
          if (pending.length > 0) {
            const packageDir = this.packageDirs.get(packageName);
            if (!packageDir) {
              console.warn(
                `Cannot run migrations for ${packageName}: package directory not found`
              );
            } else {
              console.log(
                `🔄 Running ${pending.length} migration(s) for ${packageName}...`
              );
              
              for (const migration of pending) {
                try {
                  // Call onBeforeMigrate hook if present
                  if (plugin.onBeforeMigrate) {
                    await plugin.onBeforeMigrate(
                      migration.fromVersion,
                      migration.toVersion
                    );
                  }
                  
                  // Execute migration
                  await executePluginMigration(migration, sql, packageDir);
                  
                  console.log(
                    `  ✅ Migrated ${packageName} from ${migration.fromVersion} to ${migration.toVersion}`
                  );
                  
                  // Call onAfterMigrate hook if present
                  if (plugin.onAfterMigrate) {
                    await plugin.onAfterMigrate(
                      migration.fromVersion,
                      migration.toVersion
                    );
                  }
                } catch (error) {
                  const err = error instanceof Error ? error : new Error(String(error));
                  
                  // Call onMigrationError hook if present
                  if (plugin.onMigrationError) {
                    await plugin.onMigrationError(
                      err,
                      migration.fromVersion,
                      migration.toVersion
                    );
                  }
                  
                  console.error(
                    `  ❌ Migration failed for ${packageName} from ${migration.fromVersion} to ${migration.toVersion}: ${err.message}`
                  );
                  // Don't throw - allow plugin to load even if migration fails
                  // This allows manual intervention
                }
              }
              
              // Update version record if at least one migration succeeded
              try {
                await updatePluginVersion(packageName, currentVersion, sql);
              } catch (error) {
                console.warn(
                  `Failed to update version record for ${packageName}: ${error instanceof Error ? error.message : String(error)}`
                );
              }
            }
          }
        } else {
          // No database available - migrations will be skipped
          // This is okay for plugins that don't need database
          if (manifest.migrations) {
            console.warn(
              `⚠️  Plugin ${packageName} has migrations but no database plugin is available. Migrations will be skipped.`
            );
          }
        }
      } catch (error) {
        // Migration system error - log but don't fail plugin load
        console.warn(
          `⚠️  Failed to run migrations for ${packageName}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return plugin;
  }

  /**
   * Get a loaded plugin by package name
   */
  getPlugin(packageName: string): YamaPlugin | null {
    return this.plugins.get(packageName) || null;
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): YamaPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by category
   */
  getPluginByCategory(category: string): YamaPlugin | null {
    for (const plugin of this.plugins.values()) {
      if (plugin.category === category) {
        return plugin;
      }
    }
    return null;
  }

  /**
   * Get all plugins by category
   */
  getPluginsByCategory(category: string): YamaPlugin[] {
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.category === category
    );
  }

  /**
   * Get plugin by type (for backward compatibility)
   */
  getPluginByType(type: string): YamaPlugin | null {
    for (const plugin of this.plugins.values()) {
      if (plugin.manifest?.type === type) {
        return plugin;
      }
    }
    return null;
  }

  /**
   * Get package directory for a plugin
   */
  getPackageDir(packageName: string): string | null {
    return this.packageDirs.get(packageName) || null;
  }

  /**
   * Get plugin API
   */
  getPluginAPI(packageName: string): any {
    return this.pluginAPIs.get(packageName) || null;
  }

  /**
   * Get all registered CLI commands from all plugins
   */
  getAllCLICommands(): import("./base.js").PluginCLICommand[] {
    const allCommands: import("./base.js").PluginCLICommand[] = [];
    for (const context of this.pluginContexts.values()) {
      // All contexts are PluginContextImpl instances
      allCommands.push(...(context as PluginContextImpl).getCLICommands());
    }
    return allCommands;
  }

  /**
   * Get all registered MCP tools from all plugins
   */
  getAllMCPTools(): import("./base.js").PluginMCPTool[] {
    const allTools: import("./base.js").PluginMCPTool[] = [];
    for (const context of this.pluginContexts.values()) {
      // All contexts are PluginContextImpl instances
      allTools.push(...(context as PluginContextImpl).getMCPTools());
    }
    return allTools;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    this.manifests.clear();
    this.packageDirs.clear();
    this.pluginAPIs.clear();
    this.pluginContexts.clear();
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();

/**
 * Set registry configuration (call before loading plugins)
 */
export function setPluginRegistryConfig(
  config: Record<string, unknown>,
  projectDir: string,
  logger?: Logger
): void {
  pluginRegistry.setConfig(config, projectDir, logger);
}


/**
 * Load a plugin
 * @param packageName - Name of the package to load
 * @param projectDir - Optional project directory to resolve packages from
 * @param pluginConfig - Plugin configuration
 */
export async function loadPlugin(
  packageName: string,
  projectDir?: string,
  pluginConfig: Record<string, unknown> = {}
): Promise<YamaPlugin> {
  return pluginRegistry.loadPlugin(packageName, projectDir, pluginConfig);
}

/**
 * Get a plugin by package name
 */
export function getPlugin(packageName: string): YamaPlugin | null {
  return pluginRegistry.getPlugin(packageName);
}

/**
 * Get plugin API
 */
export function getPluginAPI(packageName: string): any {
  return pluginRegistry.getPluginAPI(packageName);
}

/**
 * Get all loaded plugins
 */
export function getAllPlugins(): YamaPlugin[] {
  return pluginRegistry.getAllPlugins();
}

/**
 * Get plugin by category
 */
export function getPluginByCategory(category: string): YamaPlugin | null {
  return pluginRegistry.getPluginByCategory(category);
}

/**
 * Get all plugins by category
 */
export function getPluginsByCategory(category: string): YamaPlugin[] {
  return pluginRegistry.getPluginsByCategory(category);
}

/**
 * Get plugin by type
 */
export function getPluginByType(type: string): YamaPlugin | null {
  return pluginRegistry.getPluginByType(type);
}

/**
 * Get all registered CLI commands from all plugins
 */
export function getAllCLICommands(): import("./base.js").PluginCLICommand[] {
  return pluginRegistry.getAllCLICommands();
}

/**
 * Get all registered MCP tools from all plugins
 */
export function getAllMCPTools(): import("./base.js").PluginMCPTool[] {
  return pluginRegistry.getAllMCPTools();
}

