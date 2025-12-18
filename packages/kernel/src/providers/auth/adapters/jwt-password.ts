/**
 * Auth Provider - JWT + Password Adapter
 * 
 * Provides authentication and authorization using JWT and password hashing.
 * Zero external dependencies - uses Node.js built-in crypto module.
 * 
 * Features:
 * - JWT access tokens (short-lived)
 * - Refresh tokens (long-lived, stored in cache)
 * - Password hashing with scrypt
 * - Password strength validation
 * - Rate limiting
 * - Account lockout
 * - Email verification
 * - Password reset
 */

import {
    createHmac,
    scrypt,
    randomBytes,
    timingSafeEqual,
    createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import type {
    Provider,
    ProviderContext,
    AuthProviderConfig,
    AuthAPI,
    JWTPayload,
    RefreshTokenPayload,
    TokenPair,
    Session,
    PasswordValidationResult,
    RateLimitResult,
    CacheAPI,
    EmailAPI,
} from '../../types.js';
import { registerAdapter } from '../../registry.js';
import { parseTTL } from '../../cache/adapters/memory.js';

const scryptAsync = promisify(scrypt);

// ============================================================================
// JWT Implementation (Zero Dependencies)
// ============================================================================

function base64UrlEncode(data: string | Buffer): string {
    const buf = typeof data === 'string' ? Buffer.from(data) : data;
    return buf.toString('base64url');
}

function base64UrlDecode(data: string): string {
    return Buffer.from(data, 'base64url').toString('utf-8');
}

function createJWT(
    payload: Record<string, unknown>,
    secret: string,
    expiresIn: number
): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + expiresIn,
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
    const signature = createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

    return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyJWT(token: string, secret: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;

        // Verify signature
        const expectedSignature = createHmac('sha256', secret)
            .update(`${headerB64}.${payloadB64}`)
            .digest('base64url');

        if (signatureB64 !== expectedSignature) return null;

        // Parse payload
        const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) return null;

        return payload;
    } catch {
        return null;
    }
}

// ============================================================================
// Password Hashing (scrypt)
// ============================================================================

const SCRYPT_N = 16384; // CPU/memory cost
const SCRYPT_R = 8;     // Block size
const SCRYPT_P = 1;     // Parallelization
const KEY_LENGTH = 64;

async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(32);
    const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

    // Format: $scrypt$N:r:p$salt$hash
    return `$scrypt$${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
        const parts = storedHash.split('$');
        if (parts.length !== 5 || parts[1] !== 'scrypt') return false;

        const [_n, _r, _p] = parts[2].split(':').map(Number);
        const salt = Buffer.from(parts[3], 'hex');
        const hash = Buffer.from(parts[4], 'hex');

        const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

        return timingSafeEqual(hash, derived);
    } catch {
        return false;
    }
}

// ============================================================================
// Password Validation
// ============================================================================

// Common passwords to deny (top 100)
const COMMON_PASSWORDS = new Set([
    'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
    'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
    'princess', 'welcome', 'shadow', 'superman', 'michael', 'password1',
    'password123', 'letmein', '123456789', 'football', 'admin', 'user',
    'demo', 'test', 'guest', 'login', 'passw0rd', 'qwerty123', '1234567890',
]);

function validatePasswordStrength(
    password: string,
    config: AuthProviderConfig['password']
): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    const minLength = config?.minLength ?? 8;
    const maxLength = config?.maxLength ?? 128;
    const requireUppercase = config?.requireUppercase ?? true;
    const requireLowercase = config?.requireLowercase ?? true;
    const requireNumber = config?.requireNumber ?? true;
    const requireSpecial = config?.requireSpecial ?? false;
    const denyCommon = config?.denyCommon ?? true;

    // Length checks
    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters`);
    } else {
        score++;
    }

    if (password.length > maxLength) {
        errors.push(`Password must be at most ${maxLength} characters`);
    }

    // Character requirements
    if (requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
        score++;
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (requireNumber && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
        score++;
    }

    if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score++;
    }

    // Common password check
    if (denyCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
        errors.push('Password is too common');
    }

    // Length bonus
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;

    return {
        valid: errors.length === 0,
        errors,
        score: Math.min(score, 4),
    };
}

// ============================================================================
// Breach Check (HaveIBeenPwned API)
// ============================================================================

async function checkPasswordBreached(password: string): Promise<boolean> {
    try {
        // SHA-1 hash of password (HIBP uses this)
        const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
        const prefix = sha1.substring(0, 5);
        const suffix = sha1.substring(5);

        // Query HIBP API
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { 'User-Agent': 'Yama-Auth-Provider/1.0' },
        });

        if (!response.ok) return false;

        const text = await response.text();
        const lines = text.split('\n');

        // Check if our suffix is in the response
        for (const line of lines) {
            const [hashSuffix] = line.split(':');
            if (hashSuffix.trim() === suffix) {
                return true; // Password has been breached
            }
        }

        return false;
    } catch {
        // If API fails, don't block - log warning
        return false;
    }
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
    count: number;
    resetAt: number;
    blockedUntil?: number;
}

class RateLimiter {
    private cache: CacheAPI;
    private prefix: string;

    constructor(cache: CacheAPI, prefix: string) {
        this.cache = cache.namespace(prefix);
        this.prefix = prefix;
    }

    async check(
        action: string,
        identifier: string,
        config: { maxAttempts: number; window: string; blockDuration?: string }
    ): Promise<RateLimitResult> {
        const key = `${action}:${identifier}`;
        const now = Date.now();
        const windowMs = parseTTL(config.window);
        const blockMs = config.blockDuration ? parseTTL(config.blockDuration) : windowMs;

        let entry = await this.cache.get<RateLimitEntry>(key);

        // Check if blocked
        if (entry?.blockedUntil && now < entry.blockedUntil) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: new Date(entry.blockedUntil),
                retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
            };
        }

        // Check if window expired
        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
        }

        // Increment count
        entry.count++;

        // Check if limit exceeded
        if (entry.count > config.maxAttempts) {
            entry.blockedUntil = now + blockMs;
            await this.cache.set(key, entry, blockMs);

            return {
                allowed: false,
                remaining: 0,
                resetAt: new Date(entry.blockedUntil),
                retryAfter: Math.ceil(blockMs / 1000),
            };
        }

        // Update cache
        await this.cache.set(key, entry, windowMs);

        return {
            allowed: true,
            remaining: config.maxAttempts - entry.count,
            resetAt: new Date(entry.resetAt),
        };
    }

    async reset(action: string, identifier: string): Promise<void> {
        const key = `${action}:${identifier}`;
        await this.cache.del(key);
    }
}

// ============================================================================
// Auth API Implementation
// ============================================================================

class JWTPasswordAuthAPI implements AuthAPI {
    private config: AuthProviderConfig;
    private context: ProviderContext;
    private rateLimiter: RateLimiter;
    private cache: CacheAPI;
    private email: EmailAPI | null = null;

    // Request-scoped user (set by middleware)
    private _user: JWTPayload | null = null;

    constructor(config: AuthProviderConfig, context: ProviderContext, cache: CacheAPI) {
        this.config = config;
        this.context = context;
        this.cache = cache;
        this.rateLimiter = new RateLimiter(cache, 'auth:ratelimit');
    }

    setEmail(email: EmailAPI): void {
        this.email = email;
    }

    // Request-scoped user management
    setUser(user: JWTPayload | null): void {
        this._user = user;
    }

    get user(): JWTPayload | null {
        return this._user;
    }

    get isAuthenticated(): boolean {
        return this._user !== null;
    }

    requireAuth(): JWTPayload {
        if (!this._user) {
            throw new Error('Authentication required');
        }
        return this._user;
    }

    // Token management
    async createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
        const expiresIn = this.config.jwt.accessTokenExpiry
            ? Math.floor(parseTTL(this.config.jwt.accessTokenExpiry) / 1000)
            : 15 * 60; // 15 minutes default

        return createJWT(payload, this.config.jwt.secret, expiresIn);
    }

    async createRefreshToken(userId: string): Promise<string> {
        const jti = randomBytes(32).toString('hex');
        const expiresIn = this.config.jwt.refreshTokenExpiry
            ? Math.floor(parseTTL(this.config.jwt.refreshTokenExpiry) / 1000)
            : 30 * 24 * 60 * 60; // 30 days default

        const token = createJWT(
            { sub: userId, jti },
            this.config.jwt.secret,
            expiresIn
        );

        // Store in cache for revocation support
        const cacheKey = `refresh:${jti}`;
        await this.cache.set(cacheKey, { userId, createdAt: Date.now() }, expiresIn * 1000);

        // Track user's refresh tokens
        const userTokensKey = `user-tokens:${userId}`;
        const userTokens = (await this.cache.get<string[]>(userTokensKey)) || [];
        userTokens.push(jti);

        // Limit max tokens per user
        const maxTokens = this.config.refreshTokens?.maxPerUser ?? 10;
        if (userTokens.length > maxTokens) {
            const toRemove = userTokens.shift();
            if (toRemove) {
                await this.cache.del(`refresh:${toRemove}`);
            }
        }

        await this.cache.set(userTokensKey, userTokens, expiresIn * 1000);

        return token;
    }

    async verifyAccessToken(token: string): Promise<JWTPayload | null> {
        return verifyJWT(token, this.config.jwt.secret);
    }

    async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
        const payload = verifyJWT(token, this.config.jwt.secret);
        if (!payload || !payload.jti) return null;

        // Check if token is revoked
        const cacheKey = `refresh:${payload.jti}`;
        const stored = await this.cache.get(cacheKey);
        if (!stored) return null;

        return payload as unknown as RefreshTokenPayload;
    }

    async refreshTokens(refreshToken: string): Promise<TokenPair> {
        const payload = await this.verifyRefreshToken(refreshToken);
        if (!payload) {
            throw new Error('Invalid or expired refresh token');
        }

        // Revoke old refresh token (rotation)
        if (this.config.refreshTokens?.rotating !== false) {
            await this.revokeRefreshToken(refreshToken);
        }

        // Create new token pair
        const accessToken = await this.createAccessToken({ sub: payload.sub });
        const newRefreshToken = await this.createRefreshToken(payload.sub);

        return { accessToken, refreshToken: newRefreshToken };
    }

    async revokeRefreshToken(token: string): Promise<void> {
        const payload = verifyJWT(token, this.config.jwt.secret);
        if (payload?.jti) {
            await this.cache.del(`refresh:${payload.jti}`);
        }
    }

    async revokeAllUserTokens(userId: string): Promise<void> {
        const userTokensKey = `user-tokens:${userId}`;
        const userTokens = (await this.cache.get<string[]>(userTokensKey)) || [];

        for (const jti of userTokens) {
            await this.cache.del(`refresh:${jti}`);
        }

        await this.cache.del(userTokensKey);
    }

    // Password management
    async hashPassword(password: string): Promise<string> {
        return hashPassword(password);
    }

    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return verifyPassword(password, hash);
    }

    validatePasswordStrength(password: string): PasswordValidationResult {
        return validatePasswordStrength(password, this.config.password);
    }

    async checkPasswordBreached(password: string): Promise<boolean> {
        if (this.config.password?.checkBreached === false) {
            return false;
        }
        return checkPasswordBreached(password);
    }

    // Email verification
    async sendVerificationEmail(userId: string, email: string): Promise<void> {
        if (!this.email) {
            throw new Error('Email provider not available');
        }

        // Generate verification token
        const token = randomBytes(32).toString('hex');
        const expiresIn = this.config.verification?.email?.expiresIn
            ? parseTTL(this.config.verification.email.expiresIn)
            : 24 * 60 * 60 * 1000; // 24 hours

        // Store token
        await this.cache.set(`verify:${token}`, { userId }, expiresIn);

        // Send email
        const verifyLink = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify/${token}`;

        await this.email.sendTemplate('verify-link', email, {
            verifyLink,
            expiresIn: '24 hours',
        });
    }

    async verifyEmail(token: string): Promise<{ userId: string }> {
        const data = await this.cache.get<{ userId: string }>(`verify:${token}`);
        if (!data) {
            throw new Error('Invalid or expired verification token');
        }

        // Delete token (one-time use)
        await this.cache.del(`verify:${token}`);

        return { userId: data.userId };
    }

    // Password reset
    async sendPasswordResetEmail(email: string): Promise<void> {
        if (!this.email) {
            throw new Error('Email provider not available');
        }

        // Generate reset token
        const token = randomBytes(32).toString('hex');
        const expiresIn = this.config.passwordReset?.expiresIn
            ? parseTTL(this.config.passwordReset.expiresIn)
            : 60 * 60 * 1000; // 1 hour

        // Store token (email is the lookup key)
        await this.cache.set(`reset:${token}`, { email }, expiresIn);

        // Send email
        const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset/${token}`;

        await this.email.sendTemplate('password-reset', email, {
            resetLink,
            expiresIn: '1 hour',
        });
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        const data = await this.cache.get<{ email: string }>(`reset:${token}`);
        if (!data) {
            throw new Error('Invalid or expired reset token');
        }

        // Validate new password
        const validation = this.validatePasswordStrength(newPassword);
        if (!validation.valid) {
            throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
        }

        // Delete token (one-time use)
        await this.cache.del(`reset:${token}`);

        // Note: The actual password update in the database should be done by the caller
        // This method just validates the token
    }

    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {
        // Validate new password
        const validation = this.validatePasswordStrength(newPassword);
        if (!validation.valid) {
            throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
        }

        // Note: The actual password verification and update should be done by the caller
        // This method just validates the new password strength
    }

    // Session management
    async getSessions(userId: string): Promise<Session[]> {
        const sessionsKey = `sessions:${userId}`;
        const sessions = await this.cache.get<Session[]>(sessionsKey);
        return sessions || [];
    }

    async getSession(sessionId: string): Promise<Session | null> {
        return this.cache.get<Session>(`session:${sessionId}`);
    }

    async revokeSession(sessionId: string): Promise<void> {
        const session = await this.cache.get<Session>(`session:${sessionId}`);
        if (session) {
            await this.cache.del(`session:${sessionId}`);

            // Remove from user's session list
            const sessionsKey = `sessions:${session.userId}`;
            const sessions = (await this.cache.get<Session[]>(sessionsKey)) || [];
            const updated = sessions.filter(s => s.id !== sessionId);
            await this.cache.set(sessionsKey, updated);
        }
    }

    async revokeAllSessions(userId: string): Promise<void> {
        const sessionsKey = `sessions:${userId}`;
        const sessions = (await this.cache.get<Session[]>(sessionsKey)) || [];

        for (const session of sessions) {
            await this.cache.del(`session:${session.id}`);
        }

        await this.cache.del(sessionsKey);
    }

    // Rate limiting
    async checkRateLimit(action: string, identifier: string): Promise<RateLimitResult> {
        const configMap: Record<string, { maxAttempts: number; window: string; blockDuration?: string } | undefined> = {
            login: this.config.rateLimit?.login,
            signup: this.config.rateLimit?.signup,
            passwordReset: this.config.rateLimit?.passwordReset,
            verification: this.config.rateLimit?.verification,
        };

        const config = configMap[action] || { maxAttempts: 10, window: '15m' };

        return this.rateLimiter.check(action, identifier, config);
    }

    // Account lockout
    async isLocked(userId: string): Promise<boolean> {
        const lockData = await this.cache.get<{ until: number }>(`lockout:${userId}`);
        if (!lockData) return false;

        if (Date.now() > lockData.until) {
            await this.cache.del(`lockout:${userId}`);
            return false;
        }

        return true;
    }

    async lockAccount(userId: string, duration?: string): Promise<void> {
        const lockDuration = duration
            ? parseTTL(duration)
            : parseTTL(this.config.lockout?.duration || '30m');

        const until = Date.now() + lockDuration;
        await this.cache.set(`lockout:${userId}`, { until }, lockDuration);

        // Send notification email if enabled
        if (this.config.lockout?.notifyEmail && this.email) {
            // Note: Would need user's email - this would typically be looked up
            // For now, we just log it
            this.context.log.warn('Account locked', { userId, unlockAt: new Date(until) });
        }
    }

    async unlockAccount(userId: string): Promise<void> {
        await this.cache.del(`lockout:${userId}`);
    }
}

// ============================================================================
// JWT Password Auth Provider
// ============================================================================

class JWTPasswordAuthProvider implements Provider<AuthProviderConfig, AuthAPI> {
    readonly type = 'auth' as const;
    readonly adapter = 'jwt-password';
    readonly version = '1.0.0';

    private api: JWTPasswordAuthAPI | null = null;

    async init(config: AuthProviderConfig, context: ProviderContext): Promise<AuthAPI> {
        // Validate JWT secret
        if (!config.jwt?.secret) {
            throw new Error(
                'JWT secret is required. Set providers.auth.jwt.secret in yama.yaml or ' +
                'JWT_SECRET environment variable.'
            );
        }

        // Get cache provider
        const cache = context.getProvider<CacheAPI>('cache');
        if (!cache) {
            throw new Error('Cache provider must be initialized before auth provider');
        }

        // Create API
        this.api = new JWTPasswordAuthAPI(config, context, cache);

        // Get email provider (may not be available yet)
        const email = context.getProvider<EmailAPI>('email');
        if (email) {
            this.api.setEmail(email);
        }

        context.log.info('Auth provider initialized', {
            accessTokenExpiry: config.jwt.accessTokenExpiry || '15m',
            refreshTokenExpiry: config.jwt.refreshTokenExpiry || '30d',
            rateLimit: config.rateLimit?.enabled !== false,
            lockout: config.lockout?.enabled !== false,
        });

        return this.api;
    }

    getAPI(): AuthAPI {
        if (!this.api) {
            throw new Error('Auth provider not initialized. Call init() first.');
        }
        return this.api;
    }

    isInitialized(): boolean {
        return this.api !== null;
    }

    async healthCheck() {
        if (!this.api) {
            return { healthy: false, error: 'Not initialized' };
        }

        return {
            healthy: true,
            details: {
                adapter: 'jwt-password',
            },
        };
    }

    // No shutdown needed for auth provider
}

// ============================================================================
// Register Adapter
// ============================================================================

registerAdapter('auth', 'jwt-password', () => new JWTPasswordAuthProvider());

// ============================================================================
// Exports
// ============================================================================

export { JWTPasswordAuthProvider, JWTPasswordAuthAPI };
export { createJWT, verifyJWT };
export { hashPassword, verifyPassword, validatePasswordStrength };
export { checkPasswordBreached };
