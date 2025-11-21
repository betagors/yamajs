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
} from "./schemas.js";

// Export auth functions
export {
  authenticateRequest,
  authorizeRequest,
  authenticateAndAuthorize,
} from "./auth.js";

// Export type generation
export { generateTypes } from "./typegen.js";

// Export entity types and functions
export {
  type EntityField,
  type EntityFieldType,
  type EntityDefinition,
  type EntityIndex,
  type YamaEntities,
  type DatabaseConfig,
  entityToSchema,
  entitiesToSchemas,
  mergeSchemas,
} from "./entities.js";

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
  type HttpServerAdapter,
  type HttpRequest,
  type HttpResponse,
  type RouteHandler,
  type HttpServerInstance,
  createHttpServerAdapter,
  registerHttpServerAdapter,
} from "./infrastructure/server.js";

// Export updated config types
export {
  type ServerConfig,
} from "./entities.js";

// Export service plugin system
export {
  type PluginManifest,
  type ServicePlugin,
  type PluginContext,
  loadServicePlugin,
  getServicePlugin,
  getServicePluginByType,
  loadPluginFromPackage,
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

