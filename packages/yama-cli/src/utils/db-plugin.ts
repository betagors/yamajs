import { getPluginByCategory, loadPlugin } from "@yama/core";

/**
 * Get database plugin API
 * Tries to find a database plugin by category, or loads common database plugins
 */
export async function getDatabasePlugin() {
  // Try to get plugin by category first
  let dbPlugin = getPluginByCategory("database");
  
  // If not found, try to load common database plugins
  if (!dbPlugin) {
    const commonPlugins = ["@yama/db-postgres"];
    for (const pluginName of commonPlugins) {
      try {
        dbPlugin = await loadPlugin(pluginName);
        break;
      } catch {
        // Continue to next plugin
      }
    }
  }
  
  if (!dbPlugin) {
    throw new Error("No database plugin found. Please install @yama/db-postgres");
  }
  
  // Initialize plugin and get API
  const api = await dbPlugin.init({});
  
  return api;
}

