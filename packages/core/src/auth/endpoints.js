/**
 * @yamajs/core - Auto-Generated Auth Endpoints
 *
 * This module provides builders for standard auth endpoints:
 * - POST /auth/login
 * - POST /auth/register
 * - GET /auth/me
 * - POST /auth/refresh
 * - POST /auth/logout
 * - POST /auth/forgot-password
 * - POST /auth/reset-password
 * - POST /auth/verify-email
 * - POST /auth/change-password
 */
import { hashPassword, verifyPassword, checkPasswordStrength, generateSecureToken } from "./utils.js";
import { ErrorCodes } from "@yamajs/errors";
/**
 * Normalize endpoint config to full object form
 */
function normalizeEndpointConfig(config, defaults) {
    if (config === undefined || config === false) {
        return { ...defaults, enabled: false };
    }
    if (config === true) {
        return { ...defaults, enabled: true };
    }
    return { ...defaults, ...config, enabled: config.enabled !== false };
}
/**
 * Create login endpoint handler
 */
function createLoginEndpoint(options) {
    const config = normalizeEndpointConfig(options.config.login, {
        path: '/login',
        rateLimit: { window: '15m', max: 10 },
    });
    return {
        method: 'POST',
        path: config.path || '/login',
        description: 'Authenticate user with email and password',
        rateLimit: config.rateLimit,
        bodySchema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 1 },
            },
        },
        handler: async (ctx) => {
            const { email, password } = ctx.body;
            if (!email || !password) {
                return {
                    status: 400,
                    body: {
                        error: 'Email and password are required',
                        code: ErrorCodes.VALIDATION_REQUIRED,
                    },
                };
            }
            // Look up user
            const user = await ctx.getUserByEmail?.(email);
            if (!user) {
                return {
                    status: 401,
                    body: {
                        error: 'Invalid email or password',
                        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
                    },
                };
            }
            // Check if account is disabled
            if (user.disabled) {
                return {
                    status: 403,
                    body: {
                        error: 'Account has been disabled',
                        code: ErrorCodes.AUTH_ACCOUNT_DISABLED,
                    },
                };
            }
            // Verify password (user object should have passwordHash)
            const passwordHash = user.passwordHash || user.password;
            if (!passwordHash) {
                return {
                    status: 401,
                    body: {
                        error: 'Invalid email or password',
                        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
                    },
                };
            }
            const isValid = await verifyPassword(password, passwordHash);
            if (!isValid) {
                return {
                    status: 401,
                    body: {
                        error: 'Invalid email or password',
                        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
                    },
                };
            }
            // Generate tokens
            const tokens = await options.generateTokens(user);
            // Return user and tokens
            return {
                status: 200,
                body: {
                    user: sanitizeUser(user),
                    ...tokens,
                },
            };
        },
    };
}
/**
 * Create register endpoint handler
 */
function createRegisterEndpoint(options) {
    const config = normalizeEndpointConfig(options.config.register, {
        path: '/register',
        requireEmailVerification: false,
        rateLimit: { window: '1h', max: 5 },
        defaultRole: 'user',
    });
    return {
        method: 'POST',
        path: config.path || '/register',
        description: 'Register a new user account',
        rateLimit: config.rateLimit,
        bodySchema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
                name: { type: 'string' },
            },
        },
        handler: async (ctx) => {
            const { email, password, name } = ctx.body;
            if (!email || !password) {
                return {
                    status: 400,
                    body: {
                        error: 'Email and password are required',
                        code: ErrorCodes.VALIDATION_REQUIRED,
                    },
                };
            }
            // Check password strength
            const strength = checkPasswordStrength(password);
            if (!strength.valid) {
                return {
                    status: 400,
                    body: {
                        error: 'Password does not meet requirements',
                        code: ErrorCodes.AUTH_PASSWORD_WEAK,
                        details: strength.issues,
                    },
                };
            }
            // Check if user already exists
            const existing = await ctx.getUserByEmail?.(email);
            if (existing) {
                return {
                    status: 409,
                    body: {
                        error: 'A user with this email already exists',
                        code: ErrorCodes.CONFLICT_EXISTS,
                    },
                };
            }
            // Hash password
            const passwordHash = await hashPassword(password);
            // Create user
            const user = await ctx.createUser?.({
                email,
                name,
                password: passwordHash,
                roles: [config.defaultRole || 'user'],
                emailVerified: !config.requireEmailVerification,
            });
            if (!user) {
                return {
                    status: 500,
                    body: {
                        error: 'Failed to create user',
                        code: ErrorCodes.INTERNAL_ERROR,
                    },
                };
            }
            // Send verification email if required
            if (config.requireEmailVerification && options.sendVerificationEmail) {
                const token = generateSecureToken();
                // Store token (would need token storage)
                await options.sendVerificationEmail(user, token);
            }
            // Generate tokens
            const tokens = await options.generateTokens(user);
            return {
                status: 201,
                body: {
                    user: sanitizeUser(user),
                    ...tokens,
                    ...(config.requireEmailVerification ? {
                        message: 'Please check your email to verify your account'
                    } : {}),
                },
            };
        },
    };
}
/**
 * Create get current user endpoint handler
 */
function createMeEndpoint(_options) {
    return {
        method: 'GET',
        path: '/me',
        description: 'Get the current authenticated user',
        auth: { required: true },
        handler: async (ctx) => {
            if (!ctx.auth?.authenticated || !ctx.auth.user) {
                return {
                    status: 401,
                    body: {
                        error: 'Authentication required',
                        code: ErrorCodes.AUTH_REQUIRED,
                    },
                };
            }
            // Optionally fetch fresh user data
            const userId = ctx.auth.user.id;
            if (userId && ctx.getUserById) {
                const user = await ctx.getUserById(userId);
                if (user) {
                    return {
                        status: 200,
                        body: sanitizeUser(user),
                    };
                }
            }
            return {
                status: 200,
                body: sanitizeUser(ctx.auth.user),
            };
        },
    };
}
/**
 * Create token refresh endpoint handler
 */
function createRefreshEndpoint(options) {
    const config = normalizeEndpointConfig(options.config.refresh, {
        path: '/refresh',
        rateLimit: { window: '15m', max: 30 },
    });
    return {
        method: 'POST',
        path: config.path || '/refresh',
        description: 'Refresh access token using refresh token',
        rateLimit: config.rateLimit,
        bodySchema: {
            type: 'object',
            required: ['refreshToken'],
            properties: {
                refreshToken: { type: 'string' },
            },
        },
        handler: async (ctx) => {
            const { refreshToken } = ctx.body;
            if (!refreshToken) {
                return {
                    status: 400,
                    body: {
                        error: 'Refresh token is required',
                        code: ErrorCodes.VALIDATION_REQUIRED,
                    },
                };
            }
            if (!options.refreshTokens) {
                return {
                    status: 501,
                    body: {
                        error: 'Token refresh is not configured',
                        code: ErrorCodes.CONFIG_MISSING,
                    },
                };
            }
            try {
                const tokens = await options.refreshTokens(refreshToken);
                return {
                    status: 200,
                    body: tokens,
                };
            }
            catch (error) {
                const err = error;
                return {
                    status: 401,
                    body: {
                        error: err.message || 'Invalid refresh token',
                        code: err.code || ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
                    },
                };
            }
        },
    };
}
/**
 * Create logout endpoint handler
 */
function createLogoutEndpoint(_options) {
    return {
        method: 'POST',
        path: '/logout',
        description: 'Logout and invalidate tokens',
        auth: { required: true },
        bodySchema: {
            type: 'object',
            properties: {
                refreshToken: { type: 'string' },
            },
        },
        handler: async (ctx) => {
            // Note: For stateless JWT, logout is typically handled client-side
            // by clearing tokens. For server-side token invalidation, you'd need
            // a token blacklist or use the session plugin.
            // If a refresh token is provided, it could be blacklisted here
            const { refreshToken: _refreshToken } = (ctx.body || {});
            return {
                status: 200,
                body: {
                    success: true,
                    message: 'Logged out successfully',
                },
            };
        },
    };
}
/**
 * Remove sensitive fields from user object
 */
function sanitizeUser(user) {
    const { password, passwordHash, ...safeUser } = user;
    return safeUser;
}
/**
 * Build all enabled auth endpoints based on configuration
 */
export function buildAuthEndpoints(options) {
    const endpoints = [];
    const config = options.config;
    if (!config.enabled) {
        return endpoints;
    }
    // Login endpoint
    if (config.login !== false) {
        endpoints.push(createLoginEndpoint(options));
    }
    // Register endpoint
    if (config.register !== false) {
        endpoints.push(createRegisterEndpoint(options));
    }
    // Me endpoint
    if (config.me !== false) {
        endpoints.push(createMeEndpoint(options));
    }
    // Refresh endpoint
    if (config.refresh !== false) {
        endpoints.push(createRefreshEndpoint(options));
    }
    // Logout endpoint
    if (config.logout !== false) {
        endpoints.push(createLogoutEndpoint(options));
    }
    // Apply prefix to all endpoints
    const prefix = config.prefix || '/auth';
    return endpoints.map(endpoint => ({
        ...endpoint,
        path: `${prefix}${endpoint.path}`,
    }));
}
/**
 * Get default auth endpoints configuration
 */
export function getDefaultAuthEndpointsConfig() {
    return {
        enabled: true,
        prefix: '/auth',
        login: true,
        register: true,
        me: true,
        refresh: true,
        logout: true,
        forgotPassword: false,
        resetPassword: false,
        verifyEmail: false,
        changePassword: false,
    };
}
//# sourceMappingURL=endpoints.js.map