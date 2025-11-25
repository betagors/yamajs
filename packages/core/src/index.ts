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
} from "./schemas";

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
} from "./schemas";

// Export rate limiting types from schemas
export {
  type RateLimitConfig,
  type RateLimitKeyStrategy,
  type RateLimitStoreType,
} from "./schemas";

// Export auth functions
export {
  authenticateRequest,
  authorizeRequest,
  authenticateAndAuthorize,
} from "./auth";

// Export auth provider registry functions
export {
  registerAuthProvider,
  getAuthProvider,
  registerOAuthProvider,
  getOAuthProvider,
  getAllOAuthProviders,
  getRegisteredProviderTypes,
} from "./auth/registry";

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
} from "./rate-limit";

// Export auth provider types
export {
  type AuthProviderHandler,
  type AuthResult,
  type OAuthProviderMetadata,
} from "./auth/types";

// Export database registry
export {
  registerGlobalDatabaseAdapter,
  getGlobalDatabaseAdapter,
} from "./infrastructure/database-registry";

// Export type generation
export { generateTypes } from "./typegen";

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
} from "./entities";

// Export CRUD generation functions
export {
  type CrudEndpoint,
  generateCrudEndpoints,
  generateAllCrudEndpoints,
  generateCrudInputSchemas,
  generateArraySchema,
} from "./crud";

// Export environment utilities
export {
  loadEnvFile,
  resolveEnvVar,
  resolveEnvVars,
} from "./env";

// Export infrastructure adapters
export {
  type DatabaseAdapter,
  type DatabaseConnection,
  createDatabaseAdapter,
  registerDatabaseAdapter,
} from "./infrastructure/database";

export {
  type CacheAdapter,
} from "./infrastructure/cache";

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
} from "./infrastructure/server";

// Export updated config types
export {
  type ServerConfig,
} from "./entities";

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
} from "./plugins/index";

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
} from "./migrations/model";

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
} from "./migrations/diff";

export {
  type MigrationYAML,
  serializeMigration,
  deserializeMigration,
  createMigration,
} from "./migrations/migration-yaml";

export {
  type ValidationError,
  validateMigrationYAML,
  validateMigrationHash,
  validateStepDependencies,
  validateMigration,
} from "./migrations/validator";

export {
  replayMigrations,
  getCurrentModelHashFromDB,
} from "./migrations/replay";

// Export trash/recycle bin types
export {
  type TrashEntry,
  type TrashStatus,
  DEFAULT_RETENTION_DAYS,
  calculateExpirationDate,
  isExpired,
} from "./migrations/trash";

