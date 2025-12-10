import { getPluginByCategory, loadPlugin, getPluginAPI, resolveEnvVars, type DatabaseConfig } from "@betagors/yama-core";
import { getConfigDir } from "./file-utils.ts";

/**
 * Build database config from plugin config or top-level database config
 * Similar to how the runtime builds it - for PGlite, URL is optional
 */
export function buildDatabaseConfig(
  config: {
    plugins?: Record<string, Record<string, unknown>> | string[];
    database?: DatabaseConfig;
  },
  pluginName?: string
): DatabaseConfig | null {
  // If top-level database config exists, use it
  if (config.database) {
    return config.database;
  }

  // Try to build from plugin config
  if (config.plugins && pluginName) {
    let pluginConfig: Record<string, unknown> | undefined;

    if (Array.isArray(config.plugins)) {
      // Find plugin config in array format
      for (const item of config.plugins) {
        if (typeof item === "object" && item !== null && pluginName in item) {
          pluginConfig = (item as Record<string, Record<string, unknown>>)[pluginName];
          break;
        } else if (item === pluginName) {
          // Plugin listed as string, no config
          pluginConfig = {};
          break;
        }
      }
    } else if (typeof config.plugins === "object") {
      // Object format: { '@plugin/name': { config: {...} } }
      pluginConfig = config.plugins[pluginName];
    }

    if (pluginConfig) {
      // Determine dialect from plugin name
      let dialect: "postgresql" | "pglite";
      if (pluginName.includes("pglite")) {
        dialect = "pglite";
      } else if (pluginName.includes("postgres")) {
        dialect = "postgresql";
      } else {
        // Default to postgresql if unknown
        dialect = "postgresql";
      }

      // Build database config from plugin config
      const dbConfig: DatabaseConfig = {
        dialect,
        ...pluginConfig,
      };

      // Resolve environment variables in URL if present
      if (typeof dbConfig.url === "string" && dbConfig.url.includes("${")) {
        dbConfig.url = resolveEnvVars(dbConfig.url) as string;
      }

      return dbConfig;
    }
  }

  return null;
}

/**
 * Get database plugin API and build database config
 * Tries to find a database plugin by category, or loads common database plugins
 * @param configPlugins Optional plugins config from yama.yaml to load plugins from
 * @param configPath Optional path to yama.yaml config file (used to determine project directory)
 * @param config Optional full config object to build database config from
 */
export async function getDatabasePlugin(
  configPlugins?: Record<string, Record<string, unknown>> | string[],
  configPath?: string,
  config?: { plugins?: Record<string, Record<string, unknown>> | string[]; database?: DatabaseConfig }
) {
  // Determine project directory from config path
  const projectDir = configPath ? getConfigDir(configPath) : process.cwd();
  
  const errors: string[] = [];
  
  // First, try to load plugins from config if provided
  if (configPlugins) {
    const pluginList = Array.isArray(configPlugins) 
      ? configPlugins 
      : Object.keys(configPlugins);
    
    for (const pluginName of pluginList) {
      try {
        const plugin = await loadPlugin(pluginName, projectDir);
        
        // Check if it's a database plugin by category
        if (plugin.category === "database") {
          // Plugin is already initialized by loadPlugin, get API from registry
          const api = getPluginAPI(pluginName);
          if (api) {
            return api;
          }
          // If API not found, plugin might not be fully initialized yet
          // This shouldn't happen, but handle gracefully
          throw new Error(`Plugin ${pluginName} was loaded but API is not available`);
        } else {
          errors.push(`Plugin ${pluginName} is not a database plugin (category: ${plugin.category || 'unknown'})`);
        }
      } catch (error) {
        // Collect all errors for better debugging
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
        errors.push(`Failed to load plugin ${pluginName}: ${errorMsg}${errorStack}`);
      }
    }
  }
  
  // Try to get plugin by category (if already loaded)
  let dbPlugin = getPluginByCategory("database");
  
  // If not found, try to load common database plugins
  if (!dbPlugin) {
    const commonPlugins = ["@betagors/yama-pglite", "@betagors/yama-postgres"];
    for (const pluginName of commonPlugins) {
      try {
        dbPlugin = await loadPlugin(pluginName, projectDir);
        if (dbPlugin && dbPlugin.category === "database") {
          break;
        } else if (dbPlugin) {
          errors.push(`Plugin ${pluginName} is not a database plugin (category: ${dbPlugin.category || 'unknown'})`);
          dbPlugin = undefined;
        }
      } catch (error) {
        // Collect all errors for better debugging
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
        errors.push(`Failed to load plugin ${pluginName}: ${errorMsg}${errorStack}`);
      }
    }
  }
  
  if (!dbPlugin) {
    const errorDetails = errors.length > 0 ? `\n\nErrors encountered:\n${errors.map(e => `  - ${e}`).join('\n')}` : '';
    throw new Error(
      `No database plugin found. Please install @betagors/yama-pglite or @betagors/yama-postgres.${errorDetails}`
    );
  }
  
  // Plugin is already initialized by loadPlugin, get API from registry
  const api = getPluginAPI(dbPlugin.name);
  if (!api) {
    throw new Error(`Plugin ${dbPlugin.name} was loaded but API is not available`);
  }
  
  return api;
}

/**
 * Get database plugin and build database config from plugin config or top-level config
 * Returns both the plugin API and the database config
 */
export async function getDatabasePluginAndConfig(
  config: {
    plugins?: Record<string, Record<string, unknown>> | string[];
    database?: DatabaseConfig;
  },
  configPath?: string
): Promise<{ plugin: Awaited<ReturnType<typeof getDatabasePlugin>>; dbConfig: DatabaseConfig }> {
  const projectDir = configPath ? getConfigDir(configPath) : process.cwd();
  
  // First, try to find database plugin from config
  let dbPluginName: string | undefined;
  if (config.plugins) {
    const pluginList = Array.isArray(config.plugins) 
      ? config.plugins 
      : Object.keys(config.plugins);
    
    for (const pluginItem of pluginList) {
      const pluginName = typeof pluginItem === "string" ? pluginItem : Object.keys(pluginItem)[0];
      try {
        const plugin = await loadPlugin(pluginName, projectDir);
        if (plugin.category === "database") {
          dbPluginName = pluginName;
          break;
        }
      } catch {
        // Continue searching
      }
    }
  }
  
  // If not found, try common plugins
  if (!dbPluginName) {
    const commonPlugins = ["@betagors/yama-pglite", "@betagors/yama-postgres"];
    for (const pluginName of commonPlugins) {
      try {
        const plugin = await loadPlugin(pluginName, projectDir);
        if (plugin && plugin.category === "database") {
          dbPluginName = pluginName;
          break;
        }
      } catch {
        // Continue searching
      }
    }
  }
  
  if (!dbPluginName) {
    throw new Error(
      "No database plugin found. Please install @betagors/yama-pglite or @betagors/yama-postgres."
    );
  }
  
  // Get plugin API
  const plugin = await getDatabasePlugin(config.plugins, configPath, config);
  
  // Build database config
  let dbConfig = buildDatabaseConfig(config, dbPluginName);
  
  // If still no config, create a default one for PGlite
  if (!dbConfig) {
    if (dbPluginName.includes("pglite")) {
      dbConfig = { dialect: "pglite" };
    } else if (dbPluginName.includes("postgres")) {
      throw new Error(
        "PostgreSQL plugin requires database configuration. Please add a 'database' section to yama.yaml or configure the plugin with a connection URL."
      );
    } else {
      throw new Error(
        "Database configuration is required. Please add a 'database' section to yama.yaml or configure the plugin."
      );
    }
  }
  
  return { plugin, dbConfig };
}

