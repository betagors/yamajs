/**
 * Yama Provider System - Contracts & Orchestration
 * 
 * This module contains ONLY:
 * - Provider interfaces (contracts)
 * - Lifecycle management
 * - Adapter registration
 * - Context typing
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

    // Database provider
    DatabaseProviderConfig,
    DatabaseAPI,
    ExecuteResult,
    TransactionAPI,
    SQLTemplateTag,
    // Database IR
    DatabaseIR,
    TableIR,
    ColumnIR,
    IndexIR,

    // Email provider
    EmailProviderConfig,
    EmailAPI,
    EmailOptions,
    EmailAttachment,
    EmailResult,
    CapturedEmail,

    // Auth provider
    AuthProviderConfig,
    AuthAPI,
    JWTPayload,
    RefreshTokenPayload,
    TokenPair,
    Session,
    PasswordValidationResult,

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
} from './registry.js';

export type { AdapterFactory } from './registry.js';

// Configuration parsing and integration
export {
    parseProvidersConfig,
    initializeProvidersFromConfig,
    getProviders,
    shutdownProvidersSystem,
    getProviderSystemHealth,
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
