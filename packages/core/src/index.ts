export function helloYamaCore() {
  return "Yama core online";
}

// Export schema validation
export {
  SchemaValidator,
  createSchemaValidator,
  schemaToJsonSchema,
  fieldToJsonSchema,
  normalizeSchemaDefinition,
  normalizeQueryOrParams,
  normalizeBodyDefinition,
  parseSchemaFieldDefinition,
  type CustomValidator,
  type SchemaField,
  type SchemaDefinition,
  type YamaSchemas,
  type ValidationResult
} from "./schemas.js";

// Export auth types from schemas
export {
  type AuthProvider,
  type AuthConfig,
  type EndpointAuth,
  type AuthContext,
  type AuthProviderType,
  type JwtAuthProvider,
  type ApiKeyAuthProvider,
  type BasicAuthProvider,
  type BasicAuthProviderStatic,
  type BasicAuthProviderDatabase,
  type OAuthAuthProvider,
} from "./schemas.js";

// Export rate limiting types from schemas
export {
  type RateLimitConfig,
  type RateLimitKeyStrategy,
  type RateLimitStoreType,
} from "./schemas.js";

// Export auth functions
export {
  authenticateRequest,
  authorizeRequest,
  authenticateAndAuthorize,
} from "./auth.js";

// Export auth provider registry functions
export {
  registerAuthProvider,
  getAuthProvider,
  registerOAuthProvider,
  getOAuthProvider,
  getAllOAuthProviders,
  getRegisteredProviderTypes,
} from "./auth/registry.js";

// Export rate limiting functions
export {
  createRateLimiter,
  createRateLimiterFromConfig,
  formatRateLimitHeaders,
  type RateLimiter,
  type RateLimitResult,
  type RateLimitStore,
  createMemoryRateLimitStore,
  MemoryRateLimitStore,
  createCacheRateLimitStore,
  CacheRateLimitStore,
  createRedisOptimizedRateLimitStore,
  RedisOptimizedRateLimitStore,
} from "./rate-limit/index.js";

// Export auth provider types
export {
  type AuthProviderHandler,
  type AuthResult,
  type OAuthProviderMetadata,
} from "./auth/types.js";

// Export database registry
export {
  registerGlobalDatabaseAdapter,
  getGlobalDatabaseAdapter,
} from "./infrastructure/database-registry.js";

// Export type generation
export { generateTypes, generateHandlerContexts } from "./typegen.js";
export type { EndpointDefinition, HandlerContextConfig, AvailableServices } from "./typegen.js";

// Export entity types and functions
export {
  type EntityField,
  type EntityFieldType,
  type EntityFieldDefinition,
  type EntityDefinition,
  type EntityIndex,
  type YamaEntities,
  type DatabaseConfig,
  type CrudConfig,
  type RelationDefinition,
  type ValidationRule,
  type ComputedFieldDefinition,
  type EntityHooks,
  entityToSchema,
  entitiesToSchemas,
  normalizeSchemas,
  mergeSchemas,
  parseFieldDefinition,
  parseRelationDefinition,
  normalizeEntityDefinition,
} from "./entities.js";

// Export CRUD generation functions
export {
  type CrudEndpoint,
  generateCrudEndpoints,
  generateAllCrudEndpoints,
  generateCrudInputSchemas,
  generateArraySchema,
} from "./crud.js";

// Export environment utilities
export {
  loadEnvFile,
  resolveEnvVar,
  resolveEnvVars,
} from "./env.js";

// Export infrastructure adapters
export {
  type DatabaseAdapter,
  type DatabaseConnection,
  createDatabaseAdapter,
  registerDatabaseAdapter,
} from "./infrastructure/database.js";

export {
  type CacheAdapter,
} from "./infrastructure/cache.js";

export {
  type StorageAdapter,
  type StorageBucket,
  type StorageConfig,
  type UploadOptions,
  type UploadResult,
  type StorageMetadata,
  createStorageAdapter,
  registerStorageAdapter,
} from "./infrastructure/storage.js";

export {
  type HttpServerAdapter,
  type HttpRequest,
  type HttpResponse,
  type RouteHandler,
  type HandlerContext,
  type HandlerFunction,
  type HttpServerInstance,
  type TraceSpan,
  createHttpServerAdapter,
  registerHttpServerAdapter,
} from "./infrastructure/server.js";

// Export monitoring types
export {
  type MonitoringHooks,
  type MonitoringService,
  type ErrorContext,
} from "./infrastructure/monitoring.js";

// Export updated config types
export {
  type ServerConfig,
} from "./entities.js";

// Export plugin system
export {
  type PluginManifest,
  type YamaPlugin,
  type PluginContext,
  type PluginMigrationDefinition,
  type PluginCLICommand,
  type PluginCLICommandOption,
  loadPlugin,
  getPlugin,
  getPluginAPI,
  getAllPlugins,
  getPluginByCategory,
  getPluginsByCategory,
  getPluginByType,
  loadPluginFromPackage,
  pluginRegistry,
  // Plugin migrations
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
  // Migration utilities
  type MigrationPlan,
  validateMigrationFile,
  getMigrationPlan,
  formatMigrationPlan,
  getPluginMigrationStatus,
  // Plugin context and dependencies
  type PluginDependencies,
  type Logger,
  PluginContextImpl,
  setPluginRegistryConfig,
  getAllCLICommands,
  getAllMCPTools,
  type DependencyResolution,
  resolvePluginDependencies,
  validateDependencies,
  // Testing utilities
  createTestPluginContext,
  mockPlugin,
  testPluginIntegration,
  // Security
  type PluginSecurityPolicy,
  validateSecurityPolicy,
  isPluginTrusted,
  // Metrics
  type PluginMetrics,
  type SummaryStats,
  type MetricsConfig,
  pluginMetricsCollector,
  recordPluginAPICall,
  recordPluginError,
  // Documentation
  type PluginDocumentation,
  generatePluginDocs,
  generateMarkdownDocs,
  generateHTMLDocs,
} from "./plugins/index.js";

// Export migration types and functions
export {
  type Model,
  type TableModel,
  type ColumnModel,
  type IndexModel,
  type ForeignKeyModel,
  type MigrationDiff,
  computeModelHash,
  entitiesToModel,
  compareModels,
} from "./migrations/model.js";

export {
  type DiffResult,
  type MigrationStepType,
  type MigrationStep,
  type AddTableStep,
  type DropTableStep,
  type AddColumnStep,
  type DropColumnStep,
  type ModifyColumnStep,
  type AddIndexStep,
  type DropIndexStep,
  type AddForeignKeyStep,
  type DropForeignKeyStep,
  type MigrationStepUnion,
  computeDiff,
  diffToSteps,
} from "./migrations/diff.js";

export {
  type MigrationYAML,
  serializeMigration,
  deserializeMigration,
  createMigration,
} from "./migrations/migration-yaml.js";

export {
  type ValidationError,
  validateMigrationYAML,
  validateMigrationHash,
  validateStepDependencies,
  validateMigration,
} from "./migrations/validator.js";

export {
  replayMigrations,
  getCurrentModelHashFromDB,
} from "./migrations/replay.js";

// Export snapshot system
export {
  type Snapshot,
  type SnapshotMetadata,
  type SnapshotManifest,
  getSnapshotsDir,
  getSnapshotPath,
  getManifestPath,
  ensureSnapshotsDir,
  loadManifest,
  saveManifest,
  createSnapshot,
  saveSnapshot,
  loadSnapshot,
  snapshotExists,
  getAllSnapshotHashes,
  findSnapshot,
  getSnapshotMetadata,
  deleteSnapshot,
  getAllSnapshots,
} from "./migrations/snapshots.js";

// Export transition system
export {
  type Transition,
  type TransitionMetadata,
  getTransitionsDir,
  getTransitionPath,
  ensureTransitionsDir,
  createTransition,
  saveTransition,
  loadTransition,
  transitionExists,
  deleteTransition,
  getAllTransitions,
} from "./migrations/transitions.js";

// Export graph path computation
export {
  type PathResult,
  type TransitionGraph,
  getGraphPath,
  loadGraph,
  buildGraph,
  saveGraph,
  findPath,
  findReversePath,
  findAllPaths,
  getDirectTransition,
  pathExists,
  getReachableSnapshots,
  getPredecessorSnapshots,
} from "./migrations/graph.js";

// Export state management
export {
  type EnvironmentState,
  getStateDir,
  getStatePath,
  ensureStateDir,
  loadState,
  saveState,
  getOrCreateState,
  updateState,
  getCurrentSnapshot,
  stateExists,
  deleteState,
  listEnvironments,
  getAllStates,
} from "./migrations/state.js";

// Export merge resolution
export {
  type ConflictType,
  type Conflict,
  type MergeResult,
  mergeSchemas as mergeMigrationSchemas,
  detectConflicts,
  canAutoMerge,
  createMergeSnapshot,
} from "./migrations/merge.js";

// Export shadow columns
export {
  type ShadowColumn,
  type ShadowManifest,
  DEFAULT_SHADOW_RETENTION_DAYS,
  getShadowsDir,
  getShadowManifestPath,
  ensureShadowsDir,
  generateShadowColumnName,
  loadShadowManifest,
  saveShadowManifest,
  registerShadowColumn,
  getShadowColumn,
  getShadowColumnsForTable,
  getActiveShadowColumns,
  getExpiredShadowColumns,
  markShadowRestored,
  deleteShadowColumn,
  isShadowExpired,
} from "./migrations/shadows.js";

// Export backup system
export {
  type BackupMetadata,
  type BackupEntry,
  type BackupChain,
  getBackupsDir,
  getSnapshotsBackupDir,
  getIncrementalBackupDir,
  getBackupManifestsDir,
  ensureBackupDirs,
  generateBackupFilename,
  calculateChecksum,
  registerBackup,
  loadBackupMetadata,
  listBackups,
  getBackupsForSnapshot,
  createBackupChain,
  loadBackupChain,
  calculateBackupSize,
  isBackupExpired,
  getExpiredBackups,
} from "./migrations/backups.js";

// Export audit logging
export {
  type AuditLogEntry,
  type AuditConfig,
  CREATE_AUDIT_LOG_TABLE_SQL,
  shouldAudit,
  createAuditEntry,
  parseRetentionPeriod,
  isAuditEntryExpired,
  toAuditOperation,
} from "./migrations/audit.js";

// Export safety classification
export {
  SafetyLevel,
  type SafetyAssessment,
  type ImpactAnalysis,
  classifyStep,
  assessTransition,
  analyzeImpact,
  isSafeForAutoDeploy,
  requiresApproval,
  getSafetySummary,
} from "./migrations/safety.js";

// Export trash/recycle bin types
export {
  type TrashEntry,
  type TrashStatus,
  DEFAULT_RETENTION_DAYS,
  calculateExpirationDate,
  isExpired,
} from "./migrations/trash.js";

// Export pagination types and utilities
export {
  type PaginationType,
  type PaginationMetadataField,
  type OffsetPaginationConfig,
  type PagePaginationConfig,
  type CursorPaginationConfig,
  type PaginationConfig,
  type NormalizedPaginationConfig,
  type PaginationMetadata,
  type PaginatedResponse,
} from "./pagination/types.js";

export {
  pageToOffset,
  normalizePaginationConfig,
  calculatePaginationMetadata,
  filterMetadata,
  wrapPaginatedResponse,
  detectPaginationFromQuery,
} from "./pagination/utils.js";

// Export middleware system
export {
  type MiddlewarePhase,
  type NextFunction,
  type MiddlewareHandler,
  type MiddlewareContext,
  type MiddlewareState,
  type MiddlewareDefinition,
  type Middleware,
  MiddlewareRegistry,
  loadMiddlewareFromFile,
} from "./middleware/index.js";

// Export type system
export {
  TypeParser,
  DatabaseTypeMapper,
  ValidationGenerator,
} from "./types/index.js";
export type {
  FieldType,
  BaseType,
  FieldDefinition,
} from "./types/index.js";

// Export variants system
export {
  VariantGenerator,
} from "./variants/index.js";
export type {
  VariantConfig,
  SchemaVariants,
  GlobalVariantDefaults,
  VariantSchema,
} from "./variants/index.js";

// Export config normalizer
export {
  normalizeConfig,
  getSchemasFromConfig,
} from "./config-normalizer.js";
export type {
  NormalizedYamaConfig,
} from "./config-normalizer.js";

// Export APIs system
export * from "./apis/index.js";
export type {
  ApisConfig,
  RestApiConfig,
  RestEndpointDefinition,
  NormalizedEndpoint,
  NormalizedRestConfig,
  NormalizedApisConfig,
} from "./apis/types.js";
export {
  normalizeApisConfig,
} from "./apis/normalizer.js";
export {
  ApiEndpointParser,
} from "./apis/parser.js";

