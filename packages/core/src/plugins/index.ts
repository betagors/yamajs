// Export plugin base types
export {
  type PluginManifest,
  type PluginLifecycle,
  type YamaPlugin,
  type ServicePlugin,
  type PluginContext,
} from "./base";

// Export plugin loader
export {
  loadPluginFromPackage,
  importPlugin,
} from "./loader";

// Export plugin validator
export {
  type ValidationResult,
  validateManifest,
  validateYamaPlugin,
  validateServicePlugin,
  validatePluginVersion,
} from "./validator";

// Export plugin registry
export {
  pluginRegistry,
  loadPlugin,
  getPlugin,
  getAllPlugins,
  getPluginByCategory,
  getPluginsByCategory,
  getPluginByType,
  // Backward compatibility exports
  servicePluginRegistry,
  loadServicePlugin,
  getServicePlugin,
  getServicePluginByType,
} from "./registry";

