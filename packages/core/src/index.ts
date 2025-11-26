export function helloYamaCore() {
  return "Yama core online";
}

// Export schema validation
export {
  SchemaValidator,
  createSchemaValidator,
  schemaToJsonSchema,
  fieldToJsonSchema,
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
  type EntityDefinition,
  type EntityIndex,
  type YamaEntities,
  type DatabaseConfig,
  type CrudConfig,
  entityToSchema,
  entitiesToSchemas,
  mergeSchemas,
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
  createHttpServerAdapter,
  registerHttpServerAdapter,
} from "./infrastructure/server.js";

// Export updated config types
export {
  type ServerConfig,
} from "./entities.js";

// Export plugin system
export {
  type PluginManifest,
  type YamaPlugin,
  type ServicePlugin,
  type PluginContext,
  loadPlugin,
  getPlugin,
  getAllPlugins,
  getPluginByCategory,
  getPluginsByCategory,
  getPluginByType,
  loadPluginFromPackage,
  // Backward compatibility exports
  loadServicePlugin,
  getServicePlugin,
  getServicePluginByType,
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

