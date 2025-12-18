/**
 * Yama v1.0 Provider System - Core Types
 * 
 * Providers are built-in, zero-dependency core services that form
 * the foundation of every Yama application.
 * 
 * The 7 core providers:
 * 1. config   - Environment variables, .env files
 * 2. logging  - Logging with pretty/json formats
 * 3. database - SQL database (PGLite/Postgres)
 * 4. cache    - In-memory/Redis caching
 * 5. email    - Email sending (SMTP/Resend/etc)
 * 6. auth     - Authentication & authorization
 * 7. storage  - File storage (local/S3)
 */

// ============================================================================
// Core Provider Types
// ============================================================================

/**
 * Base provider interface - all providers implement this
 */
export interface Provider<TConfig = unknown, TAPI = unknown> {
    /** Provider type name (e.g., 'database', 'logging') */
    readonly type: ProviderType;

    /** Currently loaded adapter name (e.g., 'pglite', 'console') */
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
    | 'logging'
    | 'database'
    | 'cache'
    | 'email'
    | 'auth'
    | 'storage';

/**
 * Provider initialization order (dependencies flow down)
 */
export const PROVIDER_INIT_ORDER: readonly ProviderType[] = [
    'config',   // First - needed for all other configs
    'logging',  // Second - needed for logging in all providers
    'database', // Third - needed for auth sessions
    'cache',    // Fourth - used by auth rate limiting
    'email',    // Fifth - needed for auth verification
    'auth',     // Sixth - depends on database, cache, email
    'storage',  // Seventh - can depend on auth for permissions
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
 * Logger interface available to all providers
 */
export interface ProviderLogger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
    child(bindings: Record<string, unknown>): ProviderLogger;
}

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

    /** Logger instance (available after logging provider init) */
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
// Config Provider Types
// ============================================================================

export interface ConfigProviderConfig {
    adapter: 'env';
    /** Additional .env file paths to load */
    paths?: string[];
}

export interface ConfigAPI {
    /** Get a config value with optional default */
    get<T = string>(key: string, defaultValue?: T): T | undefined;

    /** Get a required config value (throws if not set) */
    getRequired<T = string>(key: string): T;

    /** Check if a config value exists */
    has(key: string): boolean;

    /** Get all config values (for debugging) */
    getAll(): Record<string, unknown>;

    /** Current environment */
    readonly env: 'development' | 'production' | 'test';

    /** Is development? */
    readonly isDev: boolean;

    /** Is production? */
    readonly isProd: boolean;

    /** Is test? */
    readonly isTest: boolean;
}

// ============================================================================
// Logging Provider Types
// ============================================================================

export interface LoggingProviderConfig {
    adapter: 'console';
    level?: LogLevel;
    format?: 'pretty' | 'json';
    timestamp?: boolean;
    colors?: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerAPI extends ProviderLogger {
    /** Current log level */
    readonly level: LogLevel;

    /** Is debug logging enabled? */
    readonly isDebugEnabled: boolean;
}

// ============================================================================
// Database Provider Types
// ============================================================================

export interface DatabaseProviderConfig {
    adapter: 'pglite' | 'postgres';
    /** PGLite: storage directory path */
    path?: string;
    /** PGLite: use in-memory mode */
    memory?: boolean;
    /** Postgres: connection URL */
    url?: string;
    /** Connection pool settings */
    pool?: {
        min?: number;
        max?: number;
    };
    /** Enable SQL debugging */
    debug?: boolean;
}

export interface DatabaseAPI {
    /** Execute a raw SQL query */
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;

    /** Execute SQL and return first row */
    queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;

    /** Execute SQL (INSERT/UPDATE/DELETE) and return result */
    execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;

    /** Start a transaction */
    transaction<T>(fn: (tx: TransactionAPI) => Promise<T>): Promise<T>;

    /** Get raw database client (for advanced use) */
    getClient(): unknown;

    /** SQL template tag for safe queries */
    readonly sql: SQLTemplateTag;
}

export interface ExecuteResult {
    rowsAffected: number;
    lastInsertId?: string;
}

export interface TransactionAPI {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
    execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
}

export type SQLTemplateTag = (
    strings: TemplateStringsArray,
    ...values: unknown[]
) => { sql: string; params: unknown[] };

// ============================================================================
// Cache Provider Types
// ============================================================================

export interface CacheProviderConfig {
    adapter: 'memory' | 'redis';
    /** Maximum number of items (memory adapter) */
    maxSize?: number;
    /** Default TTL (e.g., '5m', '1h', '1d') */
    ttl?: string;
    /** Redis URL (redis adapter) */
    url?: string;
}

export interface CacheAPI {
    /** Get a cached value */
    get<T>(key: string): Promise<T | null>;

    /** Set a cached value */
    set<T>(key: string, value: T, ttl?: string | number): Promise<void>;

    /** Delete a cached value */
    del(key: string): Promise<void>;

    /** Check if key exists */
    exists(key: string): Promise<boolean>;

    /** Get multiple values */
    mget<T>(keys: string[]): Promise<(T | null)[]>;

    /** Set multiple values */
    mset<T>(entries: Record<string, T>, ttl?: string | number): Promise<void>;

    /** Delete multiple values */
    mdel(keys: string[]): Promise<void>;

    /** Clear all cached values */
    clear(): Promise<void>;

    /** Create a namespaced cache */
    namespace(prefix: string): CacheAPI;

    /** Get or compute value (cache-aside pattern) */
    getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttl?: string | number
    ): Promise<T>;
}

// ============================================================================
// Email Provider Types
// ============================================================================

export interface EmailProviderConfig {
    adapter: 'smtp' | 'resend' | 'sendgrid' | 'capture';
    /** Default from address */
    from: string;
    /** Default reply-to address */
    replyTo?: string;

    /** SMTP configuration */
    smtp?: {
        host: string;
        port: number;
        secure?: boolean;
        auth?: {
            user: string;
            pass: string;
        };
    };

    /** Resend API key */
    resendApiKey?: string;

    /** SendGrid API key */
    sendgridApiKey?: string;

    /** Dev mode settings */
    dev?: {
        /** Save emails to .yama/emails/ */
        capture?: boolean;
        /** Log to console */
        console?: boolean;
        /** Enable /__yama/emails UI */
        ui?: boolean;
    };

    /** Custom templates directory */
    templates?: string;
}

export interface EmailAPI {
    /** Send an email */
    send(options: EmailOptions): Promise<EmailResult>;

    /** Send using a template */
    sendTemplate(
        template: string,
        to: string | string[],
        data: Record<string, unknown>,
        options?: Partial<EmailOptions>
    ): Promise<EmailResult>;

    /** Check if email is in dev capture mode */
    readonly isDevMode: boolean;

    /** Get captured emails (dev mode only) */
    getCapturedEmails(): Promise<CapturedEmail[]>;

    /** Clear captured emails (dev mode only) */
    clearCapturedEmails(): Promise<void>;
}

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: EmailAttachment[];
}

export interface EmailAttachment {
    filename: string;
    content: string | Uint8Array;
    contentType?: string;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface CapturedEmail {
    id: string;
    to: string[];
    from: string;
    subject: string;
    html?: string;
    text?: string;
    sentAt: Date;
    /** Extracted links for testing */
    links: string[];
}

// ============================================================================
// Auth Provider Types
// ============================================================================

export interface AuthProviderConfig {
    adapter: 'jwt-password';

    /** JWT configuration */
    jwt: {
        secret: string;
        accessTokenExpiry?: string;
        refreshTokenExpiry?: string;
        issuer?: string;
        audience?: string;
    };

    /** Cookie configuration */
    cookie?: {
        enabled?: boolean;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: 'strict' | 'lax' | 'none';
        name?: string;
    };

    /** Refresh token settings */
    refreshTokens?: {
        enabled?: boolean;
        storage?: 'database' | 'redis';
        maxPerUser?: number;
        rotating?: boolean;
    };

    /** Password requirements */
    password?: {
        minLength?: number;
        maxLength?: number;
        requireUppercase?: boolean;
        requireLowercase?: boolean;
        requireNumber?: boolean;
        requireSpecial?: boolean;
        checkBreached?: boolean;
        denyCommon?: boolean;
    };

    /** Rate limiting */
    rateLimit?: {
        enabled?: boolean;
        login?: RateLimitConfig;
        signup?: RateLimitConfig;
        passwordReset?: RateLimitConfig;
        verification?: RateLimitConfig;
    };

    /** Account lockout */
    lockout?: {
        enabled?: boolean;
        maxAttempts?: number;
        duration?: string;
        notifyEmail?: boolean;
    };

    /** Session management */
    sessions?: {
        enabled?: boolean;
        maxPerUser?: number;
        trackDevice?: boolean;
        trackIP?: boolean;
        trackUserAgent?: boolean;
    };

    /** Email verification */
    verification?: {
        email?: {
            enabled?: boolean;
            required?: boolean;
            method?: 'link' | 'code';
            expiresIn?: string;
            template?: string;
        };
    };

    /** Password reset */
    passwordReset?: {
        enabled?: boolean;
        method?: 'link' | 'code';
        expiresIn?: string;
        template?: string;
    };
}

export interface RateLimitConfig {
    maxAttempts: number;
    window: string;
    blockDuration?: string;
}

export interface AuthAPI {
    // Current request context
    /** Current authenticated user (from JWT) */
    readonly user: JWTPayload | null;

    /** Is the current request authenticated? */
    readonly isAuthenticated: boolean;

    /** Require authentication (throws if not authenticated) */
    requireAuth(): JWTPayload;

    // Token management
    /** Create an access token */
    createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string>;

    /** Create a refresh token for a user */
    createRefreshToken(userId: string): Promise<string>;

    /** Verify an access token */
    verifyAccessToken(token: string): Promise<JWTPayload | null>;

    /** Verify a refresh token */
    verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null>;

    /** Refresh tokens (get new access + refresh tokens) */
    refreshTokens(refreshToken: string): Promise<TokenPair>;

    /** Revoke a specific refresh token */
    revokeRefreshToken(token: string): Promise<void>;

    /** Revoke all refresh tokens for a user */
    revokeAllUserTokens(userId: string): Promise<void>;

    // Password management
    /** Hash a password */
    hashPassword(password: string): Promise<string>;

    /** Verify a password against a hash */
    verifyPassword(password: string, hash: string): Promise<boolean>;

    /** Validate password strength */
    validatePasswordStrength(password: string): PasswordValidationResult;

    /** Check if password has been breached */
    checkPasswordBreached(password: string): Promise<boolean>;

    // Email verification
    /** Send verification email */
    sendVerificationEmail(userId: string, email: string): Promise<void>;

    /** Verify email with token */
    verifyEmail(token: string): Promise<{ userId: string }>;

    // Password reset
    /** Send password reset email */
    sendPasswordResetEmail(email: string): Promise<void>;

    /** Reset password with token */
    resetPassword(token: string, newPassword: string): Promise<void>;

    /** Change password (when logged in) */
    changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<void>;

    // Session management
    /** Get all sessions for a user */
    getSessions(userId: string): Promise<Session[]>;

    /** Get a specific session */
    getSession(sessionId: string): Promise<Session | null>;

    /** Revoke a specific session */
    revokeSession(sessionId: string): Promise<void>;

    /** Revoke all sessions for a user */
    revokeAllSessions(userId: string): Promise<void>;

    // Rate limiting
    /** Check rate limit for an action */
    checkRateLimit(action: string, identifier: string): Promise<RateLimitResult>;

    // Account lockout
    /** Check if account is locked */
    isLocked(userId: string): Promise<boolean>;

    /** Lock an account */
    lockAccount(userId: string, duration?: string): Promise<void>;

    /** Unlock an account */
    unlockAccount(userId: string): Promise<void>;
}

export interface JWTPayload {
    /** Subject (user ID) */
    sub: string;
    /** Email (optional) */
    email?: string;
    /** Single role */
    role?: string;
    /** Multiple roles */
    roles?: string[];
    /** Issued at */
    iat: number;
    /** Expiration */
    exp: number;
    /** Custom claims */
    [key: string]: unknown;
}

export interface RefreshTokenPayload {
    /** Token ID */
    jti: string;
    /** User ID */
    sub: string;
    /** Issued at */
    iat: number;
    /** Expiration */
    exp: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface Session {
    id: string;
    userId: string;
    deviceInfo?: {
        type?: string;
        browser?: string;
        os?: string;
    };
    ipAddress?: string;
    userAgent?: string;
    lastActiveAt: Date;
    createdAt: Date;
    expiresAt: Date;
}

export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    /** Strength score 0-4 */
    score: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
}

// ============================================================================
// Storage Provider Types
// ============================================================================

export interface StorageProviderConfig {
    adapter: 'local' | 's3';
    /** Base path for local storage */
    path?: string;
    /** Maximum file size (e.g., '10MB', '1GB') */
    maxFileSize?: string;
    /** Allowed MIME types (e.g., ['image/*', 'application/pdf']) */
    allowedTypes?: string[];

    /** Static file serving */
    serve?: {
        enabled?: boolean;
        path?: string;
    };

    /** S3 configuration */
    s3?: {
        bucket: string;
        region: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        endpoint?: string;
    };
}

export interface StorageAPI {
    /** Upload a file */
    upload(
        data: Uint8Array | ReadableStream<Uint8Array> | string,
        path: string,
        options?: UploadOptions
    ): Promise<UploadResult>;

    /** Download a file */
    download(path: string): Promise<Uint8Array>;

    /** Stream a file */
    stream(path: string): Promise<ReadableStream<Uint8Array>>;

    /** Get a URL for a file */
    getUrl(path: string, expiresIn?: number): Promise<string>;

    /** Delete a file */
    delete(path: string): Promise<void>;

    /** Check if a file exists */
    exists(path: string): Promise<boolean>;

    /** List files with optional prefix */
    list(prefix?: string): Promise<FileInfo[]>;

    /** Get file metadata */
    getMetadata(path: string): Promise<FileMetadata | null>;

    /** Copy a file */
    copy(source: string, dest: string): Promise<void>;

    /** Move a file */
    move(source: string, dest: string): Promise<void>;
}

export interface UploadOptions {
    contentType?: string;
    contentDisposition?: string;
    metadata?: Record<string, string>;
    overwrite?: boolean;
}

export interface UploadResult {
    path: string;
    url: string;
    size: number;
    contentType?: string;
}

export interface FileInfo {
    path: string;
    size: number;
    isDirectory: boolean;
    modifiedAt: Date;
}

export interface FileMetadata {
    path: string;
    size: number;
    contentType?: string;
    modifiedAt: Date;
    metadata?: Record<string, string>;
}

// ============================================================================
// Provider Configuration (combined)
// ============================================================================

/**
 * All providers configuration (used in yama.yaml)
 */
export interface ProvidersConfig {
    config?: ConfigProviderConfig;
    logging?: LoggingProviderConfig;
    database?: DatabaseProviderConfig;
    cache?: CacheProviderConfig;
    email?: EmailProviderConfig;
    auth?: AuthProviderConfig;
    storage?: StorageProviderConfig;
}

/**
 * All provider APIs (used in handler context)
 */
export interface ProviderAPIs {
    config: ConfigAPI;
    log: LoggerAPI;
    db: DatabaseAPI;
    cache: CacheAPI;
    email: EmailAPI;
    auth: AuthAPI;
    storage: StorageAPI;
}
