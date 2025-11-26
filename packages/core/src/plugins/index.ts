// Export plugin base types
export {
  type PluginManifest,
  type PluginLifecycle,
  type YamaPlugin,
  type ServicePlugin,
  type PluginContext,
} from "./base.js";

// Export plugin loader
export {
  loadPluginFromPackage,
  importPlugin,
} from "./loader.js";

// Export plugin validator
export {
  type ValidationResult,
  validateManifest,
  validateYamaPlugin,
  validateServicePlugin,
  validatePluginVersion,
} from "./validator.js";

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
} from "./registry.js";

