import jwt from "jsonwebtoken";
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
 * Validate JWT token
 */
async function validateJwt(token, provider) {
    try {
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
        const payload = jwt.verify(token, secret, options);
        return { valid: true, payload };
    }
    catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : String(error),
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
            roles: payload.roles || payload.role ? [].concat(payload.roles || payload.role) : undefined,
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
        };
    },
};
export default jwtHandler;
//# sourceMappingURL=jwt.js.map