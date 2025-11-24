import { getPluginByCategory, loadPlugin } from "@betagors/yama-core";
import { getConfigDir } from "./file-utils.ts";

/**
 * Get database plugin API
 * Tries to find a database plugin by category, or loads common database plugins
 * @param configPlugins Optional plugins config from yama.yaml to load plugins from
 * @param configPath Optional path to yama.yaml config file (used to determine project directory)
 */
export async function getDatabasePlugin(
  configPlugins?: Record<string, Record<string, unknown>> | string[],
  configPath?: string
) {
  // Determine project directory from config path
  const projectDir = configPath ? getConfigDir(configPath) : process.cwd();
  
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
          const pluginConfig = typeof configPlugins === "object" && !Array.isArray(configPlugins)
            ? configPlugins[pluginName] || {}
            : {};
          
          // Initialize plugin and get API
          const api = await plugin.init(pluginConfig);
          return api;
        }
      } catch (error) {
        // Log error but continue to try other methods
        console.warn(`⚠️  Failed to load plugin ${pluginName}:`, error instanceof Error ? error.message : String(error));
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
        break;
      } catch (error) {
        // Log error for debugging
        console.warn(`⚠️  Failed to load plugin ${pluginName}:`, error instanceof Error ? error.message : String(error));
        // Continue to next plugin
      }
    }
  }
  
  if (!dbPlugin) {
    throw new Error("No database plugin found. Please install @betagors/yama-pglite or @betagors/yama-postgres");
  }
  
  // Initialize plugin and get API
  const api = await dbPlugin.init({});
  
  return api;
}

