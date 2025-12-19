/**
 * Yama v1.0 Provider System - Core Types
 * 
 * Providers are built-in, zero-dependency core services that form
 * the foundation of every Yama application.
 */
import type { Logger } from "@yamajs/logging";

import type {
    ConfigProviderConfig,
    ConfigAPI
} from "./config/index.js";

import type {
    DatabaseProviderConfig,
    DatabaseAPI,
    ExecuteResult,
    TransactionAPI,
    SQLTemplateTag,
    DatabaseIR,
    TableIR,
    ColumnIR,
    IndexIR
} from "./database/index.js";

import type {
    EmailProviderConfig,
    EmailAPI,
    EmailOptions,
    EmailAttachment,
    EmailResult,
    CapturedEmail
} from "./email/index.js";

import type {
    AuthProviderConfig,
    AuthAPI,
    JWTPayload,
    RefreshTokenPayload,
    TokenPair,
    Session,
    PasswordValidationResult
} from "./auth/index.js";

import type {
    StorageProviderConfig,
    StorageAPI,
    UploadOptions,
    UploadResult,
    FileInfo,
    FileMetadata
} from "./storage/index.js";

export type {
    ConfigProviderConfig,
    ConfigAPI,
    DatabaseProviderConfig,
    DatabaseAPI,
    ExecuteResult,
    TransactionAPI,
    SQLTemplateTag,
    DatabaseIR,
    TableIR,
    ColumnIR,
    IndexIR,
    EmailProviderConfig,
    EmailAPI,
    EmailOptions,
    EmailAttachment,
    EmailResult,
    CapturedEmail,
    AuthProviderConfig,
    AuthAPI,
    JWTPayload,
    RefreshTokenPayload,
    TokenPair,
    Session,
    PasswordValidationResult,
    StorageProviderConfig,
    StorageAPI,
    UploadOptions,
    UploadResult,
    FileInfo,
    FileMetadata
};

// ============================================================================
// Core Provider Types
// ============================================================================

/**
 * Base provider interface - all providers implement this
 */
export interface Provider<TConfig = unknown, TAPI = unknown> {
    /** Provider type name (e.g., 'database', 'auth') */
    readonly type: ProviderType;

    /** Currently loaded adapter name (e.g., 'pglite', 'smtp') */
    readonly adapter: string;

    /** Provider version */
    readonly version: string;

    /** Initialize the provider with config */
    init(config: TConfig, context: ProviderContext): Promise<TAPI>;

    /** Get the provider API (must be initialized first) */
    getAPI(): TAPI;

    /** Check if provider is initialized */
    isInitialized(): boolean;

    /** Health check */
    healthCheck?(): Promise<HealthCheckResult>;

    /** Graceful shutdown */
    shutdown?(): Promise<void>;
}

/**
 * Provider type names
 */
export type ProviderType =
    | 'config'
    | 'database'
    | 'email'
    | 'auth'
    | 'storage';

/**
 * Provider initialization order (dependencies flow down)
 */
export const PROVIDER_INIT_ORDER: readonly ProviderType[] = [
    'config',   // First - needed for all other configs
    'database', // Second - needed for auth sessions
    'email',    // Third - needed for auth verification
    'auth',     // Fourth - depends on database, email
    'storage',  // Fifth - can depend on auth for permissions
] as const;

/**
 * Health check result
 */
export interface HealthCheckResult {
    healthy: boolean;
    latency?: number;
    details?: Record<string, unknown>;
    error?: string;
}

/**
 * Provider factory function type
 */
export type ProviderFactory<TConfig = unknown, TAPI = unknown> = (
    adapter: string
) => Provider<TConfig, TAPI>;

// ============================================================================
// Provider Context
// ============================================================================

/**
 * Logger interface available to all providers.
 * Now simply re-exports the core Logger.
 */
export type ProviderLogger = Logger;

/**
 * Provider context - shared with all providers during initialization
 */
export interface ProviderContext {
    /** Project directory path */
    projectDir: string;

    /** Current environment */
    env: 'development' | 'production' | 'test';

    /** Is development environment? */
    isDev: boolean;

    /** Is production environment? */
    isProd: boolean;

    /** Logger instance */
    log: ProviderLogger;

    /** Get a config value (available after config provider init) */
    getConfig<T>(key: string, defaultValue?: T): T | undefined;

    /** Get a required config value (throws if not set) */
    getRequiredConfig<T>(key: string): T;

    /** Get another provider's API (only for initialized providers) */
    getProvider<T>(type: ProviderType): T | null;

    /** Check if a provider is initialized */
    isProviderInitialized(type: ProviderType): boolean;
}

// ============================================================================
// Provider Configuration (combined)
// ============================================================================

/**
 * All providers configuration (used in yama.yaml)
 */
export interface ProvidersConfig {
    config?: ConfigProviderConfig;
    database?: DatabaseProviderConfig;
    email?: EmailProviderConfig;
    auth?: AuthProviderConfig;
    storage?: StorageProviderConfig;
}

/**
 * All provider APIs (used in handler context)
 */
export interface ProviderAPIs {
    config: ConfigAPI;
    db: DatabaseAPI;
    email: EmailAPI;
    auth: AuthAPI;
    storage: StorageAPI;
}
