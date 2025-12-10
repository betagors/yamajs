// Export plugin loader
export { loadPluginFromPackage, importPlugin, } from "./loader.js";
// Export plugin validator
export { validateManifest, validateYamaPlugin, validatePluginVersion, validateMigrations, validatePluginConfig, } from "./validator.js";
// Export plugin registry
export { pluginRegistry, loadPlugin, getPlugin, getPluginAPI, getAllPlugins, getPluginByCategory, getPluginsByCategory, getPluginByType, setPluginRegistryConfig, getAllCLICommands, getAllMCPTools, } from "./registry.js";
// Export plugin migrations
export { PLUGIN_MIGRATIONS_TABLE_SQL, PLUGIN_VERSIONS_TABLE_SQL, ensurePluginMigrationTables, getInstalledPluginVersion, getPendingPluginMigrations, executePluginMigration, rollbackPluginMigration, updatePluginVersion, getPluginPackageDir, getPluginMigrationHistory, } from "./migrations.js";
// Export migration utilities
export { validateMigrationFile, getMigrationPlan, formatMigrationPlan, getPluginMigrationStatus, } from "./migration-utils.js";
// Export plugin context
export { PluginContextImpl, } from "./context.js";
// Export dependency resolution
export { buildDependencyGraph, detectCircularDependencies, topologicalSort, resolvePluginDependencies, validateDependencies, } from "./dependencies.js";
// Export testing utilities
export { createMockLogger, createTestPluginContext, mockPlugin, testPluginIntegration, createTestRegistry, waitForEvent, } from "./testing.js";
// Export security features
export { validateSecurityPolicy, isPluginTrusted, getSecurityWarnings, } from "./security.js";
// Export metrics
export { pluginMetricsCollector, trackPluginLoad, trackPluginInit, recordPluginLoaded, recordPluginInitialized, recordPluginAPICall, recordPluginError, } from "./metrics.js";
// Export documentation generator
export { generatePluginDocs, generateMarkdownDocs, generateHTMLDocs, } from "./docs-generator.js";
//# sourceMappingURL=index.js.map