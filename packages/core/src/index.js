export function helloYamaCore() {
    return "Yama core online";
}
// Platform configuration hooks
export { setFileSystem, setPathModule, getFileSystem, getPathModule, } from "./platform/fs.js";
export { setEnvProvider, getEnvProvider } from "./platform/env.js";
export { setCryptoProvider, setPasswordHasher, getCryptoProvider, getPasswordHasher, } from "./platform/crypto.js";
// Export schema validation
export { SchemaValidator, createSchemaValidator, schemaToJsonSchema, fieldToJsonSchema, normalizeSchemaDefinition, normalizeQueryOrParams, normalizeBodyDefinition, parseSchemaFieldDefinition } from "./schemas.js";
// Export auth functions
export { authenticateRequest, authorizeRequest, authenticateAndAuthorize, } from "./auth.js";
// Export auth provider registry functions
export { registerAuthProvider, getAuthProvider, registerOAuthProvider, getOAuthProvider, getAllOAuthProviders, getRegisteredProviderTypes, } from "./auth/registry.js";
// Export rate limiting functions
export { createRateLimiter, createRateLimiterFromConfig, formatRateLimitHeaders, createMemoryRateLimitStore, MemoryRateLimitStore, createCacheRateLimitStore, CacheRateLimitStore, createRedisOptimizedRateLimitStore, RedisOptimizedRateLimitStore, } from "./rate-limit/index.js";
// Export auth utilities
export { hashPassword, verifyPassword, checkPasswordStrength, generateSecureToken, generateOTP, secureCompare, } from "./auth/utils.js";
// Export auth context helpers
export { enhanceAuthContext, createPermissionChecker, matchesPermission, getRolePermissions, extractRolePermissions, } from "./auth/context-helpers.js";
// Export auth endpoints builder
export { buildAuthEndpoints, getDefaultAuthEndpointsConfig, } from "./auth/endpoints.js";
// Export database registry
export { registerGlobalDatabaseAdapter, getGlobalDatabaseAdapter, } from "./infrastructure/database-registry.js";
// Export type generation
export { generateTypes, generateHandlerContexts } from "./typegen.js";
// Export entity types and functions
export { entityToSchema, entitiesToSchemas, normalizeSchemas, mergeSchemas, parseFieldDefinition, parseRelationDefinition, normalizeEntityDefinition, } from "./entities.js";
// Export CRUD generation functions
export { generateCrudEndpoints, generateAllCrudEndpoints, generateCrudInputSchemas, generateArraySchema, } from "./crud.js";
// Export operations module
export { parseOperation, parseOperations, extractEntityName, inferMethodFromName, inferPathFromName, inferOperationType, generateEndpointFromOperation, generateEndpointsFromOperations, } from "./operations/index.js";
// Export policies module
export { resolvePolicy, normalizePolicy, mergePolicies, DEFAULT_PUBLIC_POLICY, } from "./policies/index.js";
// Export environment utilities
export { loadEnvFile, resolveEnvVar, resolveEnvVars, } from "./env.js";
// Export configuration system
export { 
// Validation
validateConfig, validateConfigOrThrow, createConfigAccessor, 
// Loading
loadConfig, loadConfigFromYaml, isConfigValid, getMissingConfig, getCurrentEnvironment, } from "./config/index.js";
// Export infrastructure adapters
export { createDatabaseAdapter, registerDatabaseAdapter, } from "./infrastructure/database.js";
export { createStorageAdapter, registerStorageAdapter, } from "./infrastructure/storage.js";
export { createHttpServerAdapter, registerHttpServerAdapter, } from "./infrastructure/server.js";
// Export plugin system
export { loadPlugin, getPlugin, getPluginAPI, getAllPlugins, getPluginByCategory, getPluginsByCategory, getPluginByType, loadPluginFromPackage, pluginRegistry, 
// Plugin migrations
PLUGIN_MIGRATIONS_TABLE_SQL, PLUGIN_VERSIONS_TABLE_SQL, ensurePluginMigrationTables, getInstalledPluginVersion, getPendingPluginMigrations, executePluginMigration, rollbackPluginMigration, updatePluginVersion, getPluginPackageDir, getPluginMigrationHistory, validateMigrationFile, getMigrationPlan, formatMigrationPlan, getPluginMigrationStatus, PluginContextImpl, setPluginRegistryConfig, getAllCLICommands, getAllMCPTools, resolvePluginDependencies, validateDependencies, 
// Testing utilities
createTestPluginContext, mockPlugin, testPluginIntegration, validateSecurityPolicy, isPluginTrusted, pluginMetricsCollector, recordPluginAPICall, recordPluginError, generatePluginDocs, generateMarkdownDocs, generateHTMLDocs, } from "./plugins/index.js";
// Export migration types and functions
export { computeModelHash, entitiesToModel, compareModels, } from "./migrations/model.js";
export { computeDiff, diffToSteps, } from "./migrations/diff.js";
export { validateMigrationHash, validateStepDependencies, validateTransition, } from "./migrations/validator.js";
// Export snapshot system
export { getSnapshotsDir, getSnapshotPath, getManifestPath, ensureSnapshotsDir, loadManifest, saveManifest, createSnapshot, saveSnapshot, loadSnapshot, snapshotExists, getAllSnapshotHashes, findSnapshot, getSnapshotMetadata, deleteSnapshot, getAllSnapshots, } from "./migrations/snapshots.js";
// Export transition system
export { getTransitionsDir, getTransitionPath, ensureTransitionsDir, createTransition, saveTransition, loadTransition, transitionExists, deleteTransition, getAllTransitions, } from "./migrations/transitions.js";
// Export graph path computation
export { getGraphPath, loadGraph, buildGraph, saveGraph, findPath, findReversePath, findAllPaths, getDirectTransition, pathExists, getReachableSnapshots, getPredecessorSnapshots, } from "./migrations/graph.js";
// Export schema versioning
export { computeSchemaHash, loadVersionHistory, saveVersionHistory, getCurrentSchemaVersion, getCurrentSchemaHash, recordSchemaVersion, hasSchemaChanged, getSchemaVersion, listSchemaVersions, loadEntitySnapshot, getVersionDiff, detectChangedEntities, } from "./migrations/versioning.js";
// Export migration generator
export { generateMigration, formatMigration, hasEntityChanges, } from "./migrations/generator.js";
// Export state management
export { getStateDir, getStatePath, ensureStateDir, loadState, saveState, getOrCreateState, updateState, getCurrentSnapshot, stateExists, deleteState, listEnvironments, getAllStates, } from "./migrations/state.js";
// Export merge resolution
export { mergeSchemas as mergeMigrationSchemas, detectConflicts, canAutoMerge, createMergeSnapshot, } from "./migrations/merge.js";
// Export shadow columns
export { DEFAULT_SHADOW_RETENTION_DAYS, getShadowsDir, getShadowManifestPath, ensureShadowsDir, generateShadowColumnName, loadShadowManifest, saveShadowManifest, registerShadowColumn, getShadowColumn, getShadowColumnsForTable, getActiveShadowColumns, getExpiredShadowColumns, markShadowRestored, deleteShadowColumn, isShadowExpired, } from "./migrations/shadows.js";
// Export backup system
export { getBackupsDir, getSnapshotsBackupDir, getIncrementalBackupDir, getBackupManifestsDir, ensureBackupDirs, generateBackupFilename, calculateChecksum, registerBackup, loadBackupMetadata, listBackups, getBackupsForSnapshot, createBackupChain, loadBackupChain, calculateBackupSize, isBackupExpired, getExpiredBackups, } from "./migrations/backups.js";
// Export audit logging
export { CREATE_AUDIT_LOG_TABLE_SQL, shouldAudit, createAuditEntry, parseRetentionPeriod, isAuditEntryExpired, toAuditOperation, } from "./migrations/audit.js";
// Export safety classification
export { SafetyLevel, classifyStep, assessTransition, assessSafety, analyzeImpact, isSafeForAutoDeploy, requiresApproval, getSafetySummary, validateForEnvironment, getPreMigrationChecks, } from "./migrations/safety.js";
// Export trash/recycle bin types
export { DEFAULT_RETENTION_DAYS, calculateExpirationDate, isExpired, } from "./migrations/trash.js";
// Export migration plugin interface
export { DEFAULT_CAPABILITIES, POSTGRES_CAPABILITIES, SQLITE_CAPABILITIES, MYSQL_CAPABILITIES, isStepSupported, validateStepsAgainstCapabilities, createBaseMigrationPlugin, } from "./migrations/plugin-interface.js";
// Export safety operations
export { DEFAULT_SAFETY_OPTIONS, checkSafetyNeeds, isDestructiveStep, generateShadowSQL, generateSnapshotSQL, registerSafetyOperations, getAuditTableSQL, createStepAuditEntry, generateSafetyAwareSQL, } from "./migrations/safety-ops.js";
export { pageToOffset, normalizePaginationConfig, calculatePaginationMetadata, filterMetadata, wrapPaginatedResponse, detectPaginationFromQuery, } from "./pagination/utils.js";
// Export middleware system
export { MiddlewareRegistry, loadMiddlewareFromFile, } from "./middleware/index.js";
// Export type system
export { TypeParser, DatabaseTypeMapper, ValidationGenerator, } from "./types/index.js";
// Export variants system
export { VariantGenerator, } from "./variants/index.js";
// Export config normalizer
export { normalizeConfig, getSchemasFromConfig, } from "./config-normalizer.js";
// Export IR builder
export { generateIR, } from "./ir/generator.js";
// Export APIs system
export * from "./apis/index.js";
export { normalizeApisConfig, } from "./apis/normalizer.js";
export { ApiEndpointParser, } from "./apis/parser.js";
//# sourceMappingURL=index.js.map