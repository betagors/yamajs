import { existsSync } from "fs";
import { findYamaConfig } from "./project-detection.ts";
import { getConfigDir, readYamaConfig } from "./file-utils.ts";
import { resolveEnvVars, loadEnvFile, setPluginRegistryConfig, loadPlugin, getAllCLICommands } from "@betagors/yama-core";
import type { PluginCLICommand } from "@betagors/yama-core";

/**
 * Load plugins from yama.yaml and return their CLI commands
 */
export async function loadPluginCommands(configPath?: string): Promise<PluginCLICommand[]> {
  const yamaConfigPath = configPath || findYamaConfig() || "yama.yaml";
  
  if (!existsSync(yamaConfigPath)) {
    return [];
  }

  try {
    const environment = process.env.NODE_ENV || "development";
    loadEnvFile(yamaConfigPath, environment);
    let config = readYamaConfig(yamaConfigPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
    };
    config = resolveEnvVars(config) as typeof config;
    const configDir = getConfigDir(yamaConfigPath);

    // Set plugin registry config
    setPluginRegistryConfig(config, configDir);

    // Get plugin list - plugins must be an array
    const pluginEntries: Array<{ name: string; config: Record<string, unknown> }> = [];
    if (config.plugins) {
      if (!Array.isArray(config.plugins)) {
        throw new Error("plugins must be an array. Format: ['@plugin/name'] or [{ '@plugin/name': { config: {...} } }]");
      }

      for (const pluginItem of config.plugins) {
        if (typeof pluginItem === "string") {
          // String shorthand: "@betagors/yama-pglite"
          pluginEntries.push({ name: pluginItem, config: {} });
        } else if (pluginItem && typeof pluginItem === "object") {
          // Object format: { "@betagors/yama-redis": { config: {...} } }
          const keys = Object.keys(pluginItem);
          if (keys.length !== 1) {
            throw new Error(`Plugin object must have exactly one key (plugin name), got: ${keys.join(", ")}`);
          }
          const pluginName = keys[0];
          const pluginValue = pluginItem[pluginName];
          const pluginConfig = pluginValue && typeof pluginValue === "object" && "config" in pluginValue
            ? (pluginValue.config as Record<string, unknown> || {})
            : {};
          pluginEntries.push({ name: pluginName, config: pluginConfig });
        } else {
          throw new Error(`Invalid plugin item: expected string or object, got ${typeof pluginItem}`);
        }
      }
    }

    // Load all plugins
    for (const { name: pluginName, config: pluginConfig } of pluginEntries) {
      try {
        await loadPlugin(pluginName, configDir, pluginConfig);
      } catch (error) {
        // Log but don't fail - some plugins might not be installed
        console.warn(`Warning: Failed to load plugin ${pluginName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Get all CLI commands from loaded plugins
    return getAllCLICommands();
  } catch (error) {
    // If loading fails, return empty array
    console.warn(`Warning: Failed to load plugin commands: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
