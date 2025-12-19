/**
 * Auth Provider Contract
 */

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
