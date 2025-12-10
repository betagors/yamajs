// Export plugin base types
export {
  type PluginManifest,
  type PluginLifecycle,
  type YamaPlugin,
  type PluginContext,
  type PluginMigrationDefinition,
  type PluginDependencies,
  type Logger,
  type PluginCLICommand,
  type PluginCLICommandOption,
  type PluginMCPTool,
  type MCPToolResult,
  type MCPToolResultContent,
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
  getAllCLICommands,
  getAllMCPTools,
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

// Export plugin lifecycle manager
export {
  PluginState,
  type PluginLifecycleEntry,
  type LifecycleManagerOptions,
  PluginLifecycleManager,
  createLifecycleManager,
} from "./lifecycle.js";

