import { ErrorCodes } from "@yamajs/errors";
import { getTokenSigner, TokenExpiredError, JsonWebTokenError } from "../../platform/crypto.js";
/**
 * Resolve environment variable references in strings
 * Supports ${VAR_NAME} syntax
 */
function resolveEnvVar(value) {
    return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
        const envValue = process.env[varName];
        if (envValue === undefined) {
            throw new Error(`Environment variable ${varName} is not set`);
        }
        return envValue;
    });
}
/**
 * Extract token from Authorization header
 */
function extractBearerToken(authHeader) {
    if (!authHeader)
        return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}
/**
 * Parse duration string to seconds
 * Supports: 15m, 1h, 7d, 30d, etc.
 */
function parseDuration(duration) {
    if (typeof duration === 'number')
        return duration;
    const match = duration.match(/^(\d+)(s|m|h|d|w)$/);
    if (!match) {
        throw new Error(`Invalid duration format: ${duration}. Use format like "15m", "1h", "7d"`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 60 * 60 * 24;
        case 'w': return value * 60 * 60 * 24 * 7;
        default: return value;
    }
}
/**
 * Validate JWT token
 */
async function validateJwt(token, provider) {
    try {
        const signer = await getTokenSigner();
        const secret = resolveEnvVar(provider.secret);
        const options = {};
        if (provider.algorithm) {
            options.algorithms = [provider.algorithm];
        }
        if (provider.issuer) {
            options.issuer = provider.issuer;
        }
        if (provider.audience) {
            options.audience = provider.audience;
        }
        const payload = await signer.verify(token, secret, options);
        return { valid: true, payload };
    }
    catch (error) {
        if (error instanceof TokenExpiredError) {
            return {
                valid: false,
                error: "Token has expired",
                errorCode: ErrorCodes.AUTH_TOKEN_EXPIRED,
            };
        }
        if (error instanceof JsonWebTokenError) {
            return {
                valid: false,
                error: error.message,
                errorCode: ErrorCodes.AUTH_INVALID_TOKEN,
            };
        }
        return {
            valid: false,
            error: error instanceof Error ? error.message : String(error),
            errorCode: ErrorCodes.AUTH_INVALID_TOKEN,
        };
    }
}
/**
 * Create auth context from JWT payload
 */
function createAuthContextFromJwt(payload, provider) {
    return {
        authenticated: true,
        user: {
            id: payload.sub || payload.id,
            email: payload.email,
            name: payload.name,
            roles: payload.roles || (payload.role ? [].concat(payload.role) : undefined),
            permissions: payload.permissions,
            emailVerified: payload.emailVerified || payload.email_verified,
            ...payload,
        },
        provider,
    };
}
/**
 * JWT auth provider handler
 */
const jwtHandler = {
    extractToken(headers) {
        return extractBearerToken(headers.authorization);
    },
    async validate(headers, config) {
        const token = extractBearerToken(headers.authorization);
        if (!token) {
            return {
                valid: false,
                context: { authenticated: false },
                error: "No JWT token provided",
                errorCode: ErrorCodes.AUTH_REQUIRED,
            };
        }
        const result = await validateJwt(token, config);
        if (result.valid && result.payload) {
            return {
                valid: true,
                context: createAuthContextFromJwt(result.payload, "jwt"),
            };
        }
        return {
            valid: false,
            context: { authenticated: false },
            error: result.error || "JWT validation failed",
            errorCode: result.errorCode || ErrorCodes.AUTH_INVALID_TOKEN,
        };
    },
    /**
     * Generate access and refresh tokens for a user
     */
    async generateTokens(user, config, options) {
        const signer = await getTokenSigner();
        const secret = resolveEnvVar(config.secret);
        // Determine expiration times
        const accessExpiresIn = options?.accessTokenExpiresIn
            || config.accessToken?.expiresIn
            || '15m';
        const refreshExpiresIn = options?.refreshTokenExpiresIn
            || config.refreshToken?.expiresIn
            || '7d';
        // Build access token payload
        const accessPayload = {
            sub: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            permissions: user.permissions,
            emailVerified: user.emailVerified,
            ...options?.additionalClaims,
        };
        // Remove undefined values
        Object.keys(accessPayload).forEach(key => {
            if (accessPayload[key] === undefined) {
                delete accessPayload[key];
            }
        });
        // Sign options
        const signOptions = {
            expiresIn: accessExpiresIn,
        };
        if (options?.issuer || config.issuer) {
            signOptions.issuer = options?.issuer || config.issuer;
        }
        if (options?.audience || config.audience) {
            signOptions.audience = options?.audience || config.audience;
        }
        if (config.algorithm) {
            signOptions.algorithm = config.algorithm;
        }
        // Generate access token
        const accessToken = await signer.sign(accessPayload, secret, signOptions);
        // Generate refresh token (simpler payload)
        const refreshPayload = {
            sub: user.id,
            type: 'refresh',
        };
        const refreshSignOptions = {
            expiresIn: refreshExpiresIn,
        };
        if (options?.issuer || config.issuer) {
            refreshSignOptions.issuer = options?.issuer || config.issuer;
        }
        if (config.algorithm) {
            refreshSignOptions.algorithm = config.algorithm;
        }
        const refreshToken = config.refreshToken?.enabled !== false
            ? await signer.sign(refreshPayload, secret, refreshSignOptions)
            : undefined;
        // Calculate expiration in seconds
        const accessExpiresInSeconds = parseDuration(accessExpiresIn);
        const refreshExpiresInSeconds = refreshToken ? parseDuration(refreshExpiresIn) : undefined;
        return {
            accessToken,
            refreshToken,
            expiresIn: accessExpiresInSeconds,
            refreshExpiresIn: refreshExpiresInSeconds,
            tokenType: 'bearer',
        };
    },
    /**
     * Refresh tokens using a refresh token
     */
    async refreshTokens(refreshToken, config) {
        const signer = await getTokenSigner();
        const secret = resolveEnvVar(config.secret);
        // Verify the refresh token
        let payload;
        try {
            const verifyOptions = {};
            if (config.algorithm) {
                verifyOptions.algorithms = [config.algorithm];
            }
            if (config.issuer) {
                verifyOptions.issuer = config.issuer;
            }
            payload = await signer.verify(refreshToken, secret, verifyOptions);
        }
        catch (error) {
            if (error instanceof TokenExpiredError) {
                const err = new Error('Refresh token has expired');
                err.code = ErrorCodes.AUTH_REFRESH_TOKEN_EXPIRED;
                throw err;
            }
            const err = new Error('Invalid refresh token');
            err.code = ErrorCodes.AUTH_REFRESH_TOKEN_INVALID;
            throw err;
        }
        // Verify it's a refresh token
        if (payload.type !== 'refresh') {
            const err = new Error('Invalid token type');
            err.code = ErrorCodes.AUTH_REFRESH_TOKEN_INVALID;
            throw err;
        }
        // Generate new tokens
        // Note: In a real implementation, you'd look up the user from the database
        // to get the latest user data (roles, permissions, etc.)
        const user = {
            id: payload.sub,
        };
        return this.generateTokens(user, config);
    },
    /**
     * Revoke a token
     * Note: JWT tokens are stateless, so revocation requires a token blacklist.
     * This is a no-op by default - implement with a store for actual revocation.
     */
    async revokeToken(_token, _config) {
        // JWT tokens are stateless - revocation would require:
        // 1. A token blacklist (Redis, database)
        // 2. Short token expiration times
        // 3. Token versioning in the database
        // 
        // This is a placeholder - implement with a store for actual revocation.
        // The session plugin can provide proper token revocation.
    },
};
export default jwtHandler;
// Export individual functions for direct use
export { validateJwt, extractBearerToken, createAuthContextFromJwt, parseDuration };
//# sourceMappingURL=jwt.js.map