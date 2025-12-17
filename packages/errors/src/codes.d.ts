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
export declare const ErrorCodes: {
    /** Generic validation failure */
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    /** Request body validation failed */
    readonly VALIDATION_BODY: "VALIDATION_BODY";
    /** Query parameter validation failed */
    readonly VALIDATION_QUERY: "VALIDATION_QUERY";
    /** Path parameter validation failed */
    readonly VALIDATION_PARAMS: "VALIDATION_PARAMS";
    /** Response validation failed (internal) */
    readonly VALIDATION_RESPONSE: "VALIDATION_RESPONSE";
    /** Required field is missing */
    readonly VALIDATION_REQUIRED: "VALIDATION_REQUIRED";
    /** Field format is invalid */
    readonly VALIDATION_FORMAT: "VALIDATION_FORMAT";
    /** Field type is incorrect */
    readonly VALIDATION_TYPE: "VALIDATION_TYPE";
    /** Value is out of allowed range */
    readonly VALIDATION_RANGE: "VALIDATION_RANGE";
    /** String length constraint violated */
    readonly VALIDATION_LENGTH: "VALIDATION_LENGTH";
    /** Enum value is invalid */
    readonly VALIDATION_ENUM: "VALIDATION_ENUM";
    /** Pattern/regex constraint violated */
    readonly VALIDATION_PATTERN: "VALIDATION_PATTERN";
    /** Authentication required but not provided */
    readonly AUTH_REQUIRED: "AUTH_REQUIRED";
    /** Invalid credentials provided */
    readonly AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS";
    /** Token is invalid or malformed */
    readonly AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN";
    /** Token has expired */
    readonly AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED";
    /** API key is invalid */
    readonly AUTH_INVALID_API_KEY: "AUTH_INVALID_API_KEY";
    /** Session has expired */
    readonly AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED";
    /** OAuth authentication failed */
    readonly AUTH_OAUTH_FAILED: "AUTH_OAUTH_FAILED";
    /** Refresh token is invalid or malformed */
    readonly AUTH_REFRESH_TOKEN_INVALID: "AUTH_REFRESH_TOKEN_INVALID";
    /** Refresh token has expired */
    readonly AUTH_REFRESH_TOKEN_EXPIRED: "AUTH_REFRESH_TOKEN_EXPIRED";
    /** MFA verification required */
    readonly AUTH_MFA_REQUIRED: "AUTH_MFA_REQUIRED";
    /** MFA code is invalid */
    readonly AUTH_MFA_INVALID_CODE: "AUTH_MFA_INVALID_CODE";
    /** Password does not meet strength requirements */
    readonly AUTH_PASSWORD_WEAK: "AUTH_PASSWORD_WEAK";
    /** Email address has not been verified */
    readonly AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED";
    /** Account is locked due to too many failed attempts */
    readonly AUTH_ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED";
    /** Account has been disabled */
    readonly AUTH_ACCOUNT_DISABLED: "AUTH_ACCOUNT_DISABLED";
    /** Generic authorization failure */
    readonly AUTHZ_FORBIDDEN: "AUTHZ_FORBIDDEN";
    /** User lacks required role */
    readonly AUTHZ_INSUFFICIENT_ROLE: "AUTHZ_INSUFFICIENT_ROLE";
    /** User lacks required permission */
    readonly AUTHZ_INSUFFICIENT_PERMISSION: "AUTHZ_INSUFFICIENT_PERMISSION";
    /** Resource ownership check failed */
    readonly AUTHZ_NOT_OWNER: "AUTHZ_NOT_OWNER";
    /** Custom authorization handler denied access */
    readonly AUTHZ_HANDLER_DENIED: "AUTHZ_HANDLER_DENIED";
    /** Generic not found */
    readonly NOT_FOUND: "NOT_FOUND";
    /** Entity/record not found */
    readonly NOT_FOUND_ENTITY: "NOT_FOUND_ENTITY";
    /** Route/endpoint not found */
    readonly NOT_FOUND_ROUTE: "NOT_FOUND_ROUTE";
    /** File not found */
    readonly NOT_FOUND_FILE: "NOT_FOUND_FILE";
    /** Handler not found */
    readonly NOT_FOUND_HANDLER: "NOT_FOUND_HANDLER";
    /** Plugin not found */
    readonly NOT_FOUND_PLUGIN: "NOT_FOUND_PLUGIN";
    /** Generic conflict */
    readonly CONFLICT: "CONFLICT";
    /** Unique constraint violation */
    readonly CONFLICT_DUPLICATE: "CONFLICT_DUPLICATE";
    /** Resource already exists */
    readonly CONFLICT_EXISTS: "CONFLICT_EXISTS";
    /** Concurrent modification conflict */
    readonly CONFLICT_VERSION: "CONFLICT_VERSION";
    /** Rate limit exceeded */
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    /** Generic configuration error */
    readonly CONFIG_ERROR: "CONFIG_ERROR";
    /** Required configuration is missing */
    readonly CONFIG_MISSING: "CONFIG_MISSING";
    /** Configuration value is invalid */
    readonly CONFIG_INVALID: "CONFIG_INVALID";
    /** Schema configuration error */
    readonly CONFIG_SCHEMA: "CONFIG_SCHEMA";
    /** Environment variable missing */
    readonly CONFIG_ENV_MISSING: "CONFIG_ENV_MISSING";
    /** Generic database error */
    readonly DB_ERROR: "DB_ERROR";
    /** Database connection failed */
    readonly DB_CONNECTION_FAILED: "DB_CONNECTION_FAILED";
    /** Database query failed */
    readonly DB_QUERY_FAILED: "DB_QUERY_FAILED";
    /** Database transaction failed */
    readonly DB_TRANSACTION_FAILED: "DB_TRANSACTION_FAILED";
    /** Unique constraint violation */
    readonly DB_UNIQUE_VIOLATION: "DB_UNIQUE_VIOLATION";
    /** Foreign key constraint violation */
    readonly DB_FOREIGN_KEY_VIOLATION: "DB_FOREIGN_KEY_VIOLATION";
    /** Check constraint violation */
    readonly DB_CHECK_VIOLATION: "DB_CHECK_VIOLATION";
    /** Migration failed */
    readonly DB_MIGRATION_FAILED: "DB_MIGRATION_FAILED";
    /** Generic plugin error */
    readonly PLUGIN_ERROR: "PLUGIN_ERROR";
    /** Plugin not found */
    readonly PLUGIN_NOT_FOUND: "PLUGIN_NOT_FOUND";
    /** Plugin initialization failed */
    readonly PLUGIN_INIT_FAILED: "PLUGIN_INIT_FAILED";
    /** Plugin dependency missing */
    readonly PLUGIN_DEPENDENCY_MISSING: "PLUGIN_DEPENDENCY_MISSING";
    /** Plugin version incompatible */
    readonly PLUGIN_VERSION_INCOMPATIBLE: "PLUGIN_VERSION_INCOMPATIBLE";
    /** Plugin configuration invalid */
    readonly PLUGIN_CONFIG_INVALID: "PLUGIN_CONFIG_INVALID";
    /** Plugin migration failed */
    readonly PLUGIN_MIGRATION_FAILED: "PLUGIN_MIGRATION_FAILED";
    /** Generic middleware error */
    readonly MIDDLEWARE_ERROR: "MIDDLEWARE_ERROR";
    /** Middleware not found */
    readonly MIDDLEWARE_NOT_FOUND: "MIDDLEWARE_NOT_FOUND";
    /** Middleware execution failed */
    readonly MIDDLEWARE_EXECUTION_FAILED: "MIDDLEWARE_EXECUTION_FAILED";
    /** Generic external service error */
    readonly EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR";
    /** External service unavailable */
    readonly EXTERNAL_SERVICE_UNAVAILABLE: "EXTERNAL_SERVICE_UNAVAILABLE";
    /** External service returned error */
    readonly EXTERNAL_SERVICE_RESPONSE_ERROR: "EXTERNAL_SERVICE_RESPONSE_ERROR";
    /** Generic timeout */
    readonly TIMEOUT: "TIMEOUT";
    /** Database query timeout */
    readonly TIMEOUT_DB: "TIMEOUT_DB";
    /** External service timeout */
    readonly TIMEOUT_EXTERNAL: "TIMEOUT_EXTERNAL";
    /** Generic internal error */
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    /** Unexpected error */
    readonly INTERNAL_UNEXPECTED: "INTERNAL_UNEXPECTED";
};
/**
 * Type for error codes
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
/**
 * Map of error codes to their default HTTP status codes
 */
export declare const ErrorCodeToStatus: Record<ErrorCode, number>;
/**
 * Get the HTTP status code for an error code
 */
export declare function getStatusForCode(code: string): number;
//# sourceMappingURL=codes.d.ts.map