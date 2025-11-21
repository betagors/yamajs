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

