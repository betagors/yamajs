import jwt from "jsonwebtoken";
import type { AuthProviderHandler, AuthResult } from "../types.js";
import type { JwtAuthProvider, AuthContext } from "../../schemas.js";

/**
 * Resolve environment variable references in strings
 * Supports ${VAR_NAME} syntax
 */
function resolveEnvVar(value: string): string {
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
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Validate JWT token
 */
async function validateJwt(
  token: string,
  provider: JwtAuthProvider
): Promise<{ valid: boolean; payload?: jwt.JwtPayload; error?: string }> {
  try {
    const secret = resolveEnvVar(provider.secret);
    const options: jwt.VerifyOptions = {};

    if (provider.algorithm) {
      options.algorithms = [provider.algorithm as jwt.Algorithm];
    }
    if (provider.issuer) {
      options.issuer = provider.issuer;
    }
    if (provider.audience) {
      options.audience = provider.audience;
    }

    const payload = jwt.verify(token, secret, options) as jwt.JwtPayload;
    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create auth context from JWT payload
 */
function createAuthContextFromJwt(
  payload: jwt.JwtPayload,
  provider: string
): AuthContext {
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
const jwtHandler: AuthProviderHandler = {
  extractToken(headers: Record<string, string | undefined>): string | null {
    return extractBearerToken(headers.authorization);
  },

  async validate(
    headers: Record<string, string | undefined>,
    config: JwtAuthProvider
  ): Promise<AuthResult> {
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

