export function helloYamaCore() {
  return "Yama core online";
}

// Platform configuration hooks
export {
  setRuntime,
  getRuntime,
  type RuntimeAdapter,
  type EnvAdapter,
  type PathAdapter,
  type FileSystemAdapter,
  type CryptoAdapter
} from "../../../../../../../core/kernel/src/platform/index.js";

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
} from "@yamajs/kernel";

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
} from "@yamajs/kernel";



// Export auth functions
export {
  authenticateRequest,
  authorizeRequest,
  authenticateAndAuthorize,
} from "@yamajs/kernel";

// Export auth provider registry functions
export {
  registerAuthProvider,
  getAuthProvider,
  registerOAuthProvider,
  getOAuthProvider,
  getAllOAuthProviders,
  getRegisteredProviderTypes,
} from "../../../../../../../core/kernel/src/auth/registry.js";



// Export auth provider types
export {
  type AuthProviderHandler,
  type AuthResult,
  type OAuthProviderMetadata,
  // New v1 auth types
  type AuthUser,
  type SessionInfo,
  type MfaInfo,
  type OAuthInfo,
  type TokenPair,
  type TokenGenerationOptions,
  type PasswordStrengthResult,
} from "../../../../../../../core/kernel/src/auth/types.js";

// Export auth plugin types
export {
  type AuthPlugin,
  type AuthPluginType,
  type AuthPluginConfig,
  type AuthPluginLogger,
  type AuthEndpoint,
  type AuthEndpointHandler,
  type AuthEndpointContext,
  type AuthEndpointResponse,
  type AuthEndpointsConfig,
  type AuthUserEntityConfig,
  type AuthPluginRegistrationOptions,
  type RegisteredAuthPlugin,
} from "../../../../../../../core/kernel/src/auth/plugin-types.js";

// Export auth utilities
export {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
  generateSecureToken,
  generateOTP,
  secureCompare,
  type PasswordStrengthOptions,
} from "../../../../../../../core/kernel/src/auth/utils.js";

// Export auth context helpers
export {
  enhanceAuthContext,
  createPermissionChecker,
  matchesPermission,
  getRolePermissions,
  extractRolePermissions,
} from "../../../../../../../core/kernel/src/auth/context-helpers.js";

// Export auth endpoints builder
export {
  buildAuthEndpoints,
  getDefaultAuthEndpointsConfig,
  type AuthEndpointBuilderOptions,
} from "../../../../../../../core/kernel/src/auth/endpoints.js";

// Export database registry
export {
  registerGlobalDatabaseAdapter,
  getGlobalDatabaseAdapter,
} from "../../../../../../../core/kernel/src/infrastructure/database-registry.js";

// Export type generation
export { generateTypes, generateHandlerContexts } from "@yamajs/kernel";
export type { EndpointDefinition, HandlerContextConfig, AvailableServices } from "@yamajs/kernel";

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
} from "@yamajs/kernel";

// Export CRUD generation functions
export {
  type CrudEndpoint,
  generateCrudEndpoints,
  generateAllCrudEndpoints,
  generateCrudInputSchemas,
  generateArraySchema,
} from "@yamajs/kernel";

// Export operations module
export {
  type OperationDefinition, // The new Runtime Definition
  type OperationYamlDefinition, // The Legacy Config Definition
  type OperationConfig,
  type ParsedOperation,
  type YamaOperations,
  type OperationResult,
  type OperationContext,
  type OperationHandler,
  type OperationType,
  parseOperation,
  parseOperations,
  extractEntityName,
  inferMethodFromName,
  inferPathFromName,
  inferOperationType,
  generateEndpointFromOperation,
  generateEndpointsFromOperations,
} from "../../../../../../../core/kernel/src/operations/index.js";

// Export Registry and Executor
export {
  OperationRegistry,
  operationRegistry,
} from "../../../../../../../core/kernel/src/operations/registry.js";

export {
  executeOperation,
  createErrorResult,
} from "../../../../../../../core/kernel/src/operations/executor.js";


// Export policies module
export {
  type PolicyDefinition,
  type YamaPolicies,
  type ResolvedPolicy,
  resolvePolicy,
  normalizePolicy,
  mergePolicies,
  DEFAULT_PUBLIC_POLICY,
} from "../../../../../../../core/kernel/src/policies/index.js";

// Export environment utilities
export {
  loadEnvFile,
  resolveEnvVar,
  resolveEnvVars,
} from "@yamajs/kernel";

// Export configuration system
export {
  // Types
  type ConfigValueType,
  type ConfigVarDefinition,
  type ConfigSchema,
  type ConfigValidationError,
  type ConfigValidationResult,
  type ResolvedConfig,
  type YamaConfigSection,
  type ConfigSource,
  type ConfigLoaderOptions,
  // Validation
  validateConfig,
  validateConfigOrThrow,
  createConfigAccessor,
  // Loading
  loadConfig,
  loadConfigFromYaml,
  isConfigValid,
  getMissingConfig,
  getCurrentEnvironment,
} from "../../../../../../../core/kernel/src/config/index.js";

// Export provider system types & registry
export type {
  Provider,
  ProviderType,
  ProviderContext,
  ProviderFactory,
  HealthCheckResult,
  StorageProviderConfig,
  StorageAPI,
  FileInfo,
  FileMetadata,
  ProviderAPIs,
  RawProvidersConfig,
} from "../../../../../../../core/kernel/src/providers/index.js";

export {
  registerAdapter,
  initializeProvidersFromConfig,
  getProviders,
  shutdownProvidersSystem,
  createRequestContext,
  createProviderHealthHandler,
} from "../../../../../../../core/kernel/src/providers/index.js";

// Export infrastructure adapters
export {
  type DatabaseAdapter,
  type DatabaseConnection,
  createDatabaseAdapter,
  registerDatabaseAdapter,
} from "../../../../../../../core/kernel/src/infrastructure/database.js";



export {
  type StorageAdapter,
  type StorageBucket,
  type StorageConfig,
  type UploadOptions,
  type UploadResult,
  type StorageMetadata,
  createStorageAdapter,
  registerStorageAdapter,
} from "../../../../../../../core/kernel/src/infrastructure/storage.js";

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
} from "../../../../../../../core/kernel/src/infrastructure/server.js";

// Export monitoring types
export {
  type MonitoringHooks,
  type MonitoringService,
  type ErrorContext,
} from "../../../../../../../core/kernel/src/infrastructure/monitoring.js";

// Export updated config types
export {
  type ServerConfig,
} from "@yamajs/kernel";

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
  // NEW: Plugin directive types and definePlugin helper
  type PluginDirectiveTarget,
  type PluginDirectiveArgs,
  type PluginDirectiveDefinition,
  type PluginSchemaOptionsSchema,
  type SchemaWithPluginOptions,
  type PluginDefinition,
  type PluginAPI,
  definePlugin,
  validatePluginDefinition,
  // Lifecycle
  PluginLifecycleManager,
  createLifecycleManager,
  registerGracefulShutdown,
  aggregateHealthCheck,
} from "../../../../../../../core/kernel/src/plugins/index.js";

// Export directives system (NEW)
export {
  // Types
  type ParsedDirective,
  type DirectiveArgs,
  type DirectiveTarget,
  type DirectiveDefinition,
  type DirectiveFieldContext,
  type DirectiveSchemaContext,
  type DirectiveTransformContext,
  type DirectiveValidateContext,
  type DirectiveValidationResult,
  type DirectiveExecutionOptions,
  type PluginSchemaConfig,
  type SchemaWithPluginConfig,
  type FieldWithDirectives,
  // Parser
  extractDirectives,
  parseDirectiveArgs,
  isValidDirectiveName,
  extractPluginFromDirective,
  // Registry
  DirectiveRegistry,
  directiveRegistry,
  registerDirective,
  getDirective,
  // Core directives
  registerCoreDirectives,
  getCoreDirectiveNames,
  // Executor
  executeFieldDirectives,
  executeSchemaDirectives,
  executeTransformDirectives,
  executeValidateDirectives,
  createTransformPipeline,
  createValidationFunction,
} from "../../../../../../../core/kernel/src/directives/index.js";

// Export enhanced schema parsing with directives (NEW)
export {
  type EnhancedSchemaField,
  type EnhancedSchemaDefinition,
  parseFieldWithDirectives,
  normalizeEnhancedSchema,
  normalizeAllSchemas,
  getPluginSchemaConfigs,
  extractAllDirectives,
} from "@yamajs/kernel";

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
} from "../../../../../../../core/kernel/src/migrations/model.js";

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
} from "../../../../../../../core/kernel/src/migrations/diff.js";

export {
  type ValidationError,
  validateMigrationHash,
  validateStepDependencies,
  validateTransition,
} from "../../../../../../../core/kernel/src/migrations/validator.js";

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
} from "../../../../../../../core/kernel/src/migrations/snapshots.js";

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
} from "../../../../../../../core/kernel/src/migrations/transitions.js";

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
} from "../../../../../../../core/kernel/src/migrations/graph.js";

// Export schema versioning
export {
  type SchemaVersion,
  type SchemaVersionHistory,
  type VersionDiff,
  computeSchemaHash,
  loadVersionHistory,
  saveVersionHistory,
  getCurrentSchemaVersion,
  getCurrentSchemaHash,
  recordSchemaVersion,
  hasSchemaChanged,
  getSchemaVersion,
  listSchemaVersions,
  loadEntitySnapshot,
  getVersionDiff,
  detectChangedEntities,
} from "../../../../../../../core/kernel/src/migrations/versioning.js";

// Export migration generator
export {
  type MigrationGeneratorOptions,
  type GeneratedMigration,
  type MigrationSafetyInfo,
  type MigrationSummary,
  generateMigration,
  formatMigration,
  hasEntityChanges,
} from "../../../../../../../core/kernel/src/migrations/generator.js";

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
} from "../../../../../../../core/kernel/src/migrations/state.js";

// Export merge resolution
export {
  type ConflictType,
  type Conflict,
  type MergeResult,
  mergeSchemas as mergeMigrationSchemas,
  detectConflicts,
  canAutoMerge,
  createMergeSnapshot,
} from "../../../../../../../core/kernel/src/migrations/merge.js";

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
} from "../../../../../../../core/kernel/src/migrations/shadows.js";

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
} from "../../../../../../../core/kernel/src/migrations/backups.js";

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
} from "../../../../../../../core/kernel/src/migrations/audit.js";

// Export safety classification
export {
  SafetyLevel,
  type SafetyAssessment,
  type ImpactAnalysis,
  type Environment,
  type EnvironmentSafetyAssessment,
  classifyStep,
  assessTransition,
  assessSafety,
  analyzeImpact,
  isSafeForAutoDeploy,
  requiresApproval,
  getSafetySummary,
  validateForEnvironment,
  getPreMigrationChecks,
} from "../../../../../../../core/kernel/src/migrations/safety.js";

// Export trash/recycle bin types
export {
  type TrashEntry,
  type TrashStatus,
  DEFAULT_RETENTION_DAYS,
  calculateExpirationDate,
  isExpired,
} from "../../../../../../../core/kernel/src/migrations/trash.js";

// Export migration plugin interface
export {
  type DatabaseCapabilities,
  type SQLGenerationResult,
  type MigrationPlugin,
  DEFAULT_CAPABILITIES,
  POSTGRES_CAPABILITIES,
  SQLITE_CAPABILITIES,
  MYSQL_CAPABILITIES,
  isStepSupported,
  validateStepsAgainstCapabilities,
  createBaseMigrationPlugin,
} from "../../../../../../../core/kernel/src/migrations/plugin-interface.js";

// Export safety operations
export {
  type SafetyOptions,
  type SafetyPreCheckResult,
  DEFAULT_SAFETY_OPTIONS,
  checkSafetyNeeds,
  isDestructiveStep,
  generateShadowSQL,
  generateSnapshotSQL,
  registerSafetyOperations,
  getAuditTableSQL,
  createStepAuditEntry,
  generateSafetyAwareSQL,
} from "../../../../../../../core/kernel/src/migrations/safety-ops.js";

// Export Phase 2: Shadow cleanup
export {
  type ShadowCleanupOptions,
  type ShadowCleanupResult,
  type ShadowColumnStatus,
  generateShadowDropSQL,
  generateShadowRestoreSQL,
  generateShadowCleanupSQL,
  listShadowsWithStatus,
  getCleanupCandidates,
  cleanupExpiredShadows,
  restoreShadowColumn,
  formatShadowList,
  formatCleanupResult as formatShadowCleanupResult,
} from "../../../../../../../core/kernel/src/migrations/shadows.js";

// Export Phase 2: Graph pruning
export {
  type GraphPruneOptions,
  type GraphPruneResult,
  type GraphStats,
  getGraphStats,
  getPrunableSnapshots,
  getOrphanedTransitions,
  pruneGraph,
  formatGraphStats,
  formatPruneResult,
} from "../../../../../../../core/kernel/src/migrations/graph.js";

// Export Phase 2: Audit cleanup
export {
  type AuditCleanupOptions,
  type AuditCleanupResult,
  type AuditStats,
  getAuditStats,
  archiveAuditEntries,
  cleanupExpiredAuditEntries,
  formatAuditStats,
  formatAuditCleanupResult,
} from "../../../../../../../core/kernel/src/migrations/audit.js";

// Export Phase 2: Index recovery
export {
  type InvalidIndex,
  type IndexRecoveryOptions,
  type IndexRecoveryResult,
  type IndexHealthCheckResult,
  getInvalidIndexes,
  checkTableIndexHealth,
  dropInvalidIndexes,
  recreateIndex,
  recoverInvalidIndexes,
  formatIndexRecoveryResult,
  formatIndexHealthCheck,
} from "../../../../../../../core/kernel/src/migrations/index-recovery.js";

// Export Phase 2: Table sandbox (via plugins)
export {
  type PluginTablePolicy,
  type SandboxViolation,
  type SandboxValidationResult,
  extractTablesFromSQL,
  validateTableAccess,
  inferPolicyFromPluginName,
  formatSandboxViolations,
  analyzePluginTableAccess,
} from "../../../../../../../core/kernel/src/plugins/table-sandbox.js";

// Export Phase 2: Dependency resolver (via plugins)
export {
  type MigrationDependency,
  type MissingDependency,
  type DependencyResolutionResult as PluginDependencyResolutionResult,
  resolveDependencies as resolvePluginMigrationDependencies,
  validateDependencyChain as validatePluginDependencyChain,
  formatDependencyResult,
  canMigrationRun,
} from "../../../../../../../core/kernel/src/plugins/dependency-resolver.js";

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
} from "../../../../../../../core/kernel/src/pagination/types.js";

export {
  pageToOffset,
  normalizePaginationConfig,
  calculatePaginationMetadata,
  filterMetadata,
  wrapPaginatedResponse,
  detectPaginationFromQuery,
} from "../../../../../../../core/kernel/src/pagination/utils.js";

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
} from "../../../../../../../core/kernel/src/middleware/index.js";

// Export type system
export {
  TypeParser,
  DatabaseTypeMapper,
  ValidationGenerator,
} from "../../../../../../../core/kernel/src/types/index.js";
export type {
  FieldType,
  BaseType,
  FieldDefinition,
} from "../../../../../../../core/kernel/src/types/index.js";

// Export config normalizer
export {
  normalizeConfig,
  getSchemasFromConfig,
  getEntitiesFromConfig,
  getOperationsFromConfig,
} from "@yamajs/kernel";
export type {
  NormalizedYamaConfig,
} from "@yamajs/kernel";
// Export IR builder
export {
  generateIR,
} from "../../../../../../../core/kernel/src/ir/generator.js";
export type {
  YamaIR,
  IRHttpEndpoint,
} from "../../../../../../../core/kernel/src/ir/types.js";

// Export APIs system
export * from "../../../../../../../core/kernel/src/apis/index.js";
export type {
  ApisConfig,
  RestApiConfig,
  RestEndpointDefinition,
  NormalizedEndpoint,
  NormalizedRestConfig,
  NormalizedApisConfig,
} from "../../../../../../../core/kernel/src/apis/types.js";
export {
  normalizeApisConfig,
} from "../../../../../../../core/kernel/src/apis/normalizer.js";
export {
  ApiEndpointParser,
} from "../../../../../../../core/kernel/src/apis/parser.js";



export {
  type Transporter
} from '../../../../../../../core/kernel/src/transporters/types.js';
