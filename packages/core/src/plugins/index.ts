// Export plugin base types
export {
  type PluginManifest,
  type PluginLifecycle,
  type YamaPlugin,
  type PluginContext,
  type PluginMigrationDefinition,
  type PluginDependencies,
  type Logger,
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
  validatePluginVersion,
  validateMigrations,
  validatePluginConfig,
} from "./validator.js";

// Export plugin registry
export {
  pluginRegistry,
  loadPlugin,
  getPlugin,
  getPluginAPI,
  getAllPlugins,
  getPluginByCategory,
  getPluginsByCategory,
  getPluginByType,
  setPluginRegistryConfig,
} from "./registry.js";

// Export plugin migrations
export {
  PLUGIN_MIGRATIONS_TABLE_SQL,
  PLUGIN_VERSIONS_TABLE_SQL,
  type PluginMigration,
  type MigrationResult,
  ensurePluginMigrationTables,
  getInstalledPluginVersion,
  getPendingPluginMigrations,
  executePluginMigration,
  rollbackPluginMigration,
  updatePluginVersion,
  getPluginPackageDir,
  getPluginMigrationHistory,
} from "./migrations.js";

// Export migration utilities
export {
  type MigrationPlan,
  validateMigrationFile,
  getMigrationPlan,
  formatMigrationPlan,
  getPluginMigrationStatus,
} from "./migration-utils.js";

// Export plugin context
export {
  PluginContextImpl,
} from "./context.js";

// Export dependency resolution
export {
  type DependencyResolution,
  buildDependencyGraph,
  detectCircularDependencies,
  topologicalSort,
  resolvePluginDependencies,
  validateDependencies,
} from "./dependencies.js";

// Export testing utilities
export {
  createMockLogger,
  createTestPluginContext,
  mockPlugin,
  testPluginIntegration,
  createTestRegistry,
  waitForEvent,
} from "./testing.js";

// Export security features
export {
  type PluginSecurityPolicy,
  type SecurityValidationResult,
  validateSecurityPolicy,
  isPluginTrusted,
  getSecurityWarnings,
} from "./security.js";

// Export metrics
export {
  type PluginMetrics,
  type SummaryStats,
  type MetricsConfig,
  pluginMetricsCollector,
  trackPluginLoad,
  trackPluginInit,
  recordPluginLoaded,
  recordPluginInitialized,
  recordPluginAPICall,
  recordPluginError,
} from "./metrics.js";

// Export documentation generator
export {
  type PluginDocumentation,
  generatePluginDocs,
  generateMarkdownDocs,
  generateHTMLDocs,
} from "./docs-generator.js";

