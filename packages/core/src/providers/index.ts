/**
 * Yama v1.0 Provider System
 * 
 * Built-in, zero-dependency core services for every Yama application.
 * 
 * @example
 * ```typescript
 * import { initializeProviders, shutdownProviders } from '@yamajs/core/providers';
 * 
 * const providers = await initializeProviders(config, projectDir);
 * 
 * // Access providers
 * providers.db.query('SELECT * FROM users');
 * providers.log.info('Hello');
 * providers.auth.requireAuth();
 * 
 * // Shutdown
 * await shutdownProviders();
 * ```
 */

// Core types
export type {
    // Provider base types
    Provider,
    ProviderType,
    ProviderContext,
    ProviderLogger,
    ProviderFactory,
    HealthCheckResult,

    // Config provider
    ConfigProviderConfig,
    ConfigAPI,

    // Logging provider
    LoggingProviderConfig,
    LogLevel,
    LoggerAPI,

    // Database provider
    DatabaseProviderConfig,
    DatabaseAPI,
    ExecuteResult,
    TransactionAPI,
    SQLTemplateTag,

    // Cache provider
    CacheProviderConfig,
    CacheAPI,

    // Email provider
    EmailProviderConfig,
    EmailAPI,
    EmailOptions,
    EmailAttachment,
    EmailResult,
    CapturedEmail,

    // Auth provider
    AuthProviderConfig,
    RateLimitConfig,
    AuthAPI,
    JWTPayload,
    RefreshTokenPayload,
    TokenPair,
    Session,
    PasswordValidationResult,
    RateLimitResult,

    // Storage provider
    StorageProviderConfig,
    StorageAPI,
    UploadOptions,
    UploadResult,
    FileInfo,
    FileMetadata,

    // Combined types
    ProvidersConfig,
    ProviderAPIs,
} from './types.js';

export { PROVIDER_INIT_ORDER } from './types.js';

// Registry
export {
    registerAdapter,
    getAdapterFactory,
    listAdapters,
    initializeProviders,
    shutdownProviders,
    getProviderAPI,
    isProviderInitialized,
    getProvidersHealth,
    INIT_ORDER,
    DEFAULT_ADAPTERS,
} from './registry.js';

export type { AdapterFactory } from './registry.js';

// Built-in adapters - registered via side-effect imports
import './config/adapters/env.js';
import './logging/adapters/console.js';
import './cache/adapters/memory.js';
import './database/adapters/pglite.js';
import './email/adapters/smtp.js';
import './auth/adapters/jwt-password.js';
import './storage/adapters/local.js';

// Re-export adapter implementations for direct use
export { substituteVariables, hasUnresolvedVariables } from './config/adapters/env.js';
export { parseTTL } from './cache/adapters/memory.js';
export { createSQLTemplateTag } from './database/adapters/pglite.js';
export { renderTemplate, extractLinks, BUILT_IN_TEMPLATES } from './email/adapters/smtp.js';
export { createJWT, verifyJWT, hashPassword, verifyPassword, validatePasswordStrength } from './auth/adapters/jwt-password.js';
export { parseFileSize, matchesMimeType, getMimeType } from './storage/adapters/local.js';

// Configuration parsing and integration
export {
    parseProvidersConfig,
    initializeProvidersFromConfig,
    getProviders,
    shutdownProvidersSystem,
    getProviderSystemHealth,
    getDefaultProvidersConfig,
} from './config-parser.js';

export type { RawProvidersConfig } from './config-parser.js';

// Handler context integration
export {
    createRequestContext,
    extractBearerToken,
    createAuthMiddleware,
    createProviderHealthHandler,
} from './handler-context.js';

export type { HandlerContextProviders } from './handler-context.js';
