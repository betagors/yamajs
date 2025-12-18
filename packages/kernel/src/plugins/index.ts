// Export plugin base types
export {
  type PluginManifest,
  type PluginLifecycle,
  type YamaPlugin,
  type PluginContext,
  type PluginMigrationDefinition,
  type PluginDependencies,
  type PluginRelationships,
  type Logger,
  type PluginCLICommand,
  type PluginCLICommandOption,
  type PluginMCPTool,
  type MCPToolResult,
  type MCPToolResultContent,
  // NEW: Directive types
  type PluginDirectiveTarget,
  type PluginDirectiveArgs,
  type PluginDirectiveDefinition,
  type PluginSchemaOptionsSchema,
  type SchemaWithPluginOptions,
} from "./base.js";

// Export plugin definition helper (NEW)
export {
  definePlugin,
  validatePluginDefinition,
  type PluginDefinition,
  type PluginAPI,
} from "./define.js";

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
  // Data migration batching (Phase 2)
  type DataMigrationOptions,
  type DataMigrationProgress,
  type DataMigrationResult,
  executeDataMigration,
  formatDataMigrationProgress,
} from "./migrations.js";

// Export migration utilities
export {
  type MigrationPlan,
  validateMigrationFile,
  getMigrationPlan,
  formatMigrationPlan,
  getPluginMigrationStatus,
} from "./migration-utils.js";

// Export migration lock (Phase 1 safety)
export {
  type LockStatus,
  type MigrationLockOptions,
  MigrationLock,
  withMigrationLock,
  GLOBAL_MIGRATION_LOCK_ID,
  createGlobalMigrationLock,
} from "./migration-lock.js";

// Export migration safety analysis (Phase 1 safety)
export {
  type DestructiveOperationType,
  type DestructiveOperation,
  type MigrationSafetyAnalysis,
  analyzeMigrationSafety,
  analyzeMultipleMigrations,
  formatSafetyAnalysis,
  isMigrationFunction,
  getConfirmationPrompt,
  validateConfirmation,
} from "./migration-safety.js";

// Export migration runner (Phase 1 safety)
export {
  type MigrationExecutionResult,
  type MigrationRunnerOptions,
  MigrationRunner,
  createMigrationRunner,
  runPluginMigrations,
  dryRunMigrations,
} from "./migration-runner.js";

// Export plugin context
export {
  PluginContextImpl,
} from "./context.js";

// Export dependency resolution
export {
  type DependencyResolution,
  type RelationshipValidation,  // NEW
  buildDependencyGraph,
  detectCircularDependencies,
  topologicalSort,
  resolvePluginDependencies,
  // NEW: Enhanced dependency functions
  validatePluginRelationships,
  detectPluginConflicts,
  buildEnhancedDependencyGraph,
  getShutdownOrder,
  canLoadPlugin,
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
  type AggregatedHealthResult,  // NEW
  PluginLifecycleManager,
  createLifecycleManager,
  // NEW: Lifecycle helpers
  registerGracefulShutdown,
  aggregateHealthCheck,
} from "./lifecycle.js";

// Export table sandbox (Phase 2 security)
export {
  type PluginTablePolicy,
  type SandboxViolation,
  type SandboxValidationResult,
  type TableAccess,
  DEFAULT_SHARED_TABLES,
  extractTableAccesses,
  extractTablesFromSQL,
  inferPolicyFromPluginName,
  isTableAllowed,
  validateTableAccess,
  mergePolicies,
  getSharedTablesList,
  createPermissivePolicy,
  formatSandboxViolations,
  analyzePluginTableAccess,
} from "./table-sandbox.js";

// Export dependency resolver (Phase 2 ecosystem)
export {
  type MigrationDependency,
  type MissingDependency,
  type DependencyResolutionResult,
  type CircularDependencyCheck,
  compareVersions,
  satisfiesVersion,
  parseMigrationDependencies,
  getAllPluginDependencies,
  resolveDependencies,
  validateDependencyChain,
  formatDependencyResult,
  canMigrationRun,
} from "./dependency-resolver.js";
