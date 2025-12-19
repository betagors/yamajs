/**
 * Standardized error codes for YAMA.
 * 
 * Error codes follow a hierarchical naming convention:
 * - CATEGORY_SPECIFIC_ERROR
 * 
 * Categories:
 * - VALIDATION_* - Input validation errors (400)
 * - AUTH_* - Authentication errors (401)
 * - AUTHZ_* - Authorization errors (403)
 * - NOT_FOUND_* - Resource not found errors (404)
 * - CONFLICT_* - Conflict errors (409)
 * - RATE_LIMIT_* - Rate limiting errors (429)
 * - CONFIG_* - Configuration errors (500)
 * - DB_* - Database errors (500)
 * - PLUGIN_* - Plugin errors (500)
 * - MIDDLEWARE_* - Middleware errors (500)
 * - EXTERNAL_* - External service errors (502)
 * - TIMEOUT_* - Timeout errors (504)
 * - INTERNAL_* - Internal server errors (500)
 */
export const ErrorCodes = {
  // ============================================================================
  // Validation Errors (400)
  // ============================================================================
  
  /** Generic validation failure */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Request body validation failed */
  VALIDATION_BODY: 'VALIDATION_BODY',
  /** Query parameter validation failed */
  VALIDATION_QUERY: 'VALIDATION_QUERY',
  /** Path parameter validation failed */
  VALIDATION_PARAMS: 'VALIDATION_PARAMS',
  /** Response validation failed (internal) */
  VALIDATION_RESPONSE: 'VALIDATION_RESPONSE',
  /** Required field is missing */
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  /** Field format is invalid */
  VALIDATION_FORMAT: 'VALIDATION_FORMAT',
  /** Field type is incorrect */
  VALIDATION_TYPE: 'VALIDATION_TYPE',
  /** Value is out of allowed range */
  VALIDATION_RANGE: 'VALIDATION_RANGE',
  /** String length constraint violated */
  VALIDATION_LENGTH: 'VALIDATION_LENGTH',
  /** Enum value is invalid */
  VALIDATION_ENUM: 'VALIDATION_ENUM',
  /** Pattern/regex constraint violated */
  VALIDATION_PATTERN: 'VALIDATION_PATTERN',

  // ============================================================================
  // Authentication Errors (401)
  // ============================================================================
  
  /** Authentication required but not provided */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /** Invalid credentials provided */
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  /** Token is invalid or malformed */
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  /** Token has expired */
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  /** API key is invalid */
  AUTH_INVALID_API_KEY: 'AUTH_INVALID_API_KEY',
  /** Session has expired */
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  /** OAuth authentication failed */
  AUTH_OAUTH_FAILED: 'AUTH_OAUTH_FAILED',
  /** Refresh token is invalid or malformed */
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  /** Refresh token has expired */
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_REFRESH_TOKEN_EXPIRED',
  /** MFA verification required */
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  /** MFA code is invalid */
  AUTH_MFA_INVALID_CODE: 'AUTH_MFA_INVALID_CODE',
  /** Password does not meet strength requirements */
  AUTH_PASSWORD_WEAK: 'AUTH_PASSWORD_WEAK',
  /** Email address has not been verified */
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  /** Account is locked due to too many failed attempts */
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  /** Account has been disabled */
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',

  // ============================================================================
  // Authorization Errors (403)
  // ============================================================================
  
  /** Generic authorization failure */
  AUTHZ_FORBIDDEN: 'AUTHZ_FORBIDDEN',
  /** User lacks required role */
  AUTHZ_INSUFFICIENT_ROLE: 'AUTHZ_INSUFFICIENT_ROLE',
  /** User lacks required permission */
  AUTHZ_INSUFFICIENT_PERMISSION: 'AUTHZ_INSUFFICIENT_PERMISSION',
  /** Resource ownership check failed */
  AUTHZ_NOT_OWNER: 'AUTHZ_NOT_OWNER',
  /** Custom authorization handler denied access */
  AUTHZ_HANDLER_DENIED: 'AUTHZ_HANDLER_DENIED',

  // ============================================================================
  // Not Found Errors (404)
  // ============================================================================
  
  /** Generic not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Entity/record not found */
  NOT_FOUND_ENTITY: 'NOT_FOUND_ENTITY',
  /** Route/endpoint not found */
  NOT_FOUND_ROUTE: 'NOT_FOUND_ROUTE',
  /** File not found */
  NOT_FOUND_FILE: 'NOT_FOUND_FILE',
  /** Handler not found */
  NOT_FOUND_HANDLER: 'NOT_FOUND_HANDLER',
  /** Plugin not found */
  NOT_FOUND_PLUGIN: 'NOT_FOUND_PLUGIN',

  // ============================================================================
  // Conflict Errors (409)
  // ============================================================================
  
  /** Generic conflict */
  CONFLICT: 'CONFLICT',
  /** Unique constraint violation */
  CONFLICT_DUPLICATE: 'CONFLICT_DUPLICATE',
  /** Resource already exists */
  CONFLICT_EXISTS: 'CONFLICT_EXISTS',
  /** Concurrent modification conflict */
  CONFLICT_VERSION: 'CONFLICT_VERSION',

  // ============================================================================
  // Rate Limit Errors (429)
  // ============================================================================
  
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // ============================================================================
  // Configuration Errors (500)
  // ============================================================================
  
  /** Generic configuration error */
  CONFIG_ERROR: 'CONFIG_ERROR',
  /** Required configuration is missing */
  CONFIG_MISSING: 'CONFIG_MISSING',
  /** Configuration value is invalid */
  CONFIG_INVALID: 'CONFIG_INVALID',
  /** Schema configuration error */
  CONFIG_SCHEMA: 'CONFIG_SCHEMA',
  /** Environment variable missing */
  CONFIG_ENV_MISSING: 'CONFIG_ENV_MISSING',

  // ============================================================================
  // Database Errors (500)
  // ============================================================================
  
  /** Generic database error */
  DB_ERROR: 'DB_ERROR',
  /** Database connection failed */
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  /** Database query failed */
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  /** Database transaction failed */
  DB_TRANSACTION_FAILED: 'DB_TRANSACTION_FAILED',
  /** Unique constraint violation */
  DB_UNIQUE_VIOLATION: 'DB_UNIQUE_VIOLATION',
  /** Foreign key constraint violation */
  DB_FOREIGN_KEY_VIOLATION: 'DB_FOREIGN_KEY_VIOLATION',
  /** Check constraint violation */
  DB_CHECK_VIOLATION: 'DB_CHECK_VIOLATION',
  /** Migration failed */
  DB_MIGRATION_FAILED: 'DB_MIGRATION_FAILED',

  // ============================================================================
  // Plugin Errors (500)
  // ============================================================================
  
  /** Generic plugin error */
  PLUGIN_ERROR: 'PLUGIN_ERROR',
  /** Plugin not found */
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  /** Plugin initialization failed */
  PLUGIN_INIT_FAILED: 'PLUGIN_INIT_FAILED',
  /** Plugin dependency missing */
  PLUGIN_DEPENDENCY_MISSING: 'PLUGIN_DEPENDENCY_MISSING',
  /** Plugin version incompatible */
  PLUGIN_VERSION_INCOMPATIBLE: 'PLUGIN_VERSION_INCOMPATIBLE',
  /** Plugin configuration invalid */
  PLUGIN_CONFIG_INVALID: 'PLUGIN_CONFIG_INVALID',
  /** Plugin migration failed */
  PLUGIN_MIGRATION_FAILED: 'PLUGIN_MIGRATION_FAILED',

  // ============================================================================
  // Middleware Errors (500)
  // ============================================================================
  
  /** Generic middleware error */
  MIDDLEWARE_ERROR: 'MIDDLEWARE_ERROR',
  /** Middleware not found */
  MIDDLEWARE_NOT_FOUND: 'MIDDLEWARE_NOT_FOUND',
  /** Middleware execution failed */
  MIDDLEWARE_EXECUTION_FAILED: 'MIDDLEWARE_EXECUTION_FAILED',

  // ============================================================================
  // External Service Errors (502)
  // ============================================================================
  
  /** Generic external service error */
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  /** External service unavailable */
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
  /** External service returned error */
  EXTERNAL_SERVICE_RESPONSE_ERROR: 'EXTERNAL_SERVICE_RESPONSE_ERROR',

  // ============================================================================
  // Timeout Errors (504)
  // ============================================================================
  
  /** Generic timeout */
  TIMEOUT: 'TIMEOUT',
  /** Database query timeout */
  TIMEOUT_DB: 'TIMEOUT_DB',
  /** External service timeout */
  TIMEOUT_EXTERNAL: 'TIMEOUT_EXTERNAL',

  // ============================================================================
  // Internal Errors (500)
  // ============================================================================
  
  /** Generic internal error */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Unexpected error */
  INTERNAL_UNEXPECTED: 'INTERNAL_UNEXPECTED',
} as const;

/**
 * Type for error codes
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Map of error codes to their default HTTP status codes
 */
export const ErrorCodeToStatus: Record<ErrorCode, number> = {
  // Validation (400)
  [ErrorCodes.VALIDATION_FAILED]: 400,
  [ErrorCodes.VALIDATION_BODY]: 400,
  [ErrorCodes.VALIDATION_QUERY]: 400,
  [ErrorCodes.VALIDATION_PARAMS]: 400,
  [ErrorCodes.VALIDATION_RESPONSE]: 500,
  [ErrorCodes.VALIDATION_REQUIRED]: 400,
  [ErrorCodes.VALIDATION_FORMAT]: 400,
  [ErrorCodes.VALIDATION_TYPE]: 400,
  [ErrorCodes.VALIDATION_RANGE]: 400,
  [ErrorCodes.VALIDATION_LENGTH]: 400,
  [ErrorCodes.VALIDATION_ENUM]: 400,
  [ErrorCodes.VALIDATION_PATTERN]: 400,
  
  // Authentication (401)
  [ErrorCodes.AUTH_REQUIRED]: 401,
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCodes.AUTH_INVALID_TOKEN]: 401,
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_INVALID_API_KEY]: 401,
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 401,
  [ErrorCodes.AUTH_OAUTH_FAILED]: 401,
  [ErrorCodes.AUTH_REFRESH_TOKEN_INVALID]: 401,
  [ErrorCodes.AUTH_REFRESH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_MFA_REQUIRED]: 401,
  [ErrorCodes.AUTH_MFA_INVALID_CODE]: 401,
  [ErrorCodes.AUTH_PASSWORD_WEAK]: 400,
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: 403,
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 403,
  [ErrorCodes.AUTH_ACCOUNT_DISABLED]: 403,
  
  // Authorization (403)
  [ErrorCodes.AUTHZ_FORBIDDEN]: 403,
  [ErrorCodes.AUTHZ_INSUFFICIENT_ROLE]: 403,
  [ErrorCodes.AUTHZ_INSUFFICIENT_PERMISSION]: 403,
  [ErrorCodes.AUTHZ_NOT_OWNER]: 403,
  [ErrorCodes.AUTHZ_HANDLER_DENIED]: 403,
  
  // Not Found (404)
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.NOT_FOUND_ENTITY]: 404,
  [ErrorCodes.NOT_FOUND_ROUTE]: 404,
  [ErrorCodes.NOT_FOUND_FILE]: 404,
  [ErrorCodes.NOT_FOUND_HANDLER]: 404,
  [ErrorCodes.NOT_FOUND_PLUGIN]: 404,
  
  // Conflict (409)
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.CONFLICT_DUPLICATE]: 409,
  [ErrorCodes.CONFLICT_EXISTS]: 409,
  [ErrorCodes.CONFLICT_VERSION]: 409,
  
  // Rate Limit (429)
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  
  // Configuration (500)
  [ErrorCodes.CONFIG_ERROR]: 500,
  [ErrorCodes.CONFIG_MISSING]: 500,
  [ErrorCodes.CONFIG_INVALID]: 500,
  [ErrorCodes.CONFIG_SCHEMA]: 500,
  [ErrorCodes.CONFIG_ENV_MISSING]: 500,
  
  // Database (500)
  [ErrorCodes.DB_ERROR]: 500,
  [ErrorCodes.DB_CONNECTION_FAILED]: 500,
  [ErrorCodes.DB_QUERY_FAILED]: 500,
  [ErrorCodes.DB_TRANSACTION_FAILED]: 500,
  [ErrorCodes.DB_UNIQUE_VIOLATION]: 409,
  [ErrorCodes.DB_FOREIGN_KEY_VIOLATION]: 400,
  [ErrorCodes.DB_CHECK_VIOLATION]: 400,
  [ErrorCodes.DB_MIGRATION_FAILED]: 500,
  
  // Plugin (500)
  [ErrorCodes.PLUGIN_ERROR]: 500,
  [ErrorCodes.PLUGIN_NOT_FOUND]: 500,
  [ErrorCodes.PLUGIN_INIT_FAILED]: 500,
  [ErrorCodes.PLUGIN_DEPENDENCY_MISSING]: 500,
  [ErrorCodes.PLUGIN_VERSION_INCOMPATIBLE]: 500,
  [ErrorCodes.PLUGIN_CONFIG_INVALID]: 500,
  [ErrorCodes.PLUGIN_MIGRATION_FAILED]: 500,
  
  // Middleware (500)
  [ErrorCodes.MIDDLEWARE_ERROR]: 500,
  [ErrorCodes.MIDDLEWARE_NOT_FOUND]: 500,
  [ErrorCodes.MIDDLEWARE_EXECUTION_FAILED]: 500,
  
  // External (502)
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.EXTERNAL_SERVICE_RESPONSE_ERROR]: 502,
  
  // Timeout (504)
  [ErrorCodes.TIMEOUT]: 504,
  [ErrorCodes.TIMEOUT_DB]: 504,
  [ErrorCodes.TIMEOUT_EXTERNAL]: 504,
  
  // Internal (500)
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.INTERNAL_UNEXPECTED]: 500,
};

/**
 * Get the HTTP status code for an error code
 */
export function getStatusForCode(code: string): number {
  return ErrorCodeToStatus[code as ErrorCode] || 500;
}
