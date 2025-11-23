import jwt from "jsonwebtoken";
import {
  type AuthProvider,
  type AuthConfig,
  type EndpointAuth,
  type AuthContext,
  type JwtAuthProvider,
  type ApiKeyAuthProvider,
} from "./schemas";

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
 * Validate API key
 */
async function validateApiKey(
  apiKey: string,
  provider: ApiKeyAuthProvider
): Promise<{ valid: boolean; error?: string }> {
  if (provider.validate) {
    try {
      const isValid = await provider.validate(apiKey);
      return { valid: isValid };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  // If no custom validator, accept any non-empty key
  // In production, you should always provide a validator
  return { valid: apiKey.length > 0 };
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
 * Create auth context from API key
 */
function createAuthContextFromApiKey(provider: string): AuthContext {
  return {
    authenticated: true,
    provider,
  };
}

/**
 * Authenticate request using configured providers
 */
export async function authenticateRequest(
  headers: Record<string, string | undefined>,
  authConfig: AuthConfig
): Promise<{ context: AuthContext; error?: string }> {
  // Try each provider in order
  for (const provider of authConfig.providers) {
    if (provider.type === "jwt") {
      const token = extractBearerToken(headers.authorization);
      if (token) {
        const result = await validateJwt(token, provider);
        if (result.valid && result.payload) {
          return {
            context: createAuthContextFromJwt(result.payload, "jwt"),
          };
        }
        // Continue to next provider if JWT validation fails
      }
    } else if (provider.type === "api-key") {
      const apiKey = headers[provider.header.toLowerCase()];
      if (apiKey) {
        const result = await validateApiKey(apiKey, provider);
        if (result.valid) {
          return {
            context: createAuthContextFromApiKey("api-key"),
          };
        }
        // Continue to next provider if API key validation fails
      }
    }
  }

  // No provider succeeded
  return {
    context: { authenticated: false },
    error: "Authentication failed: no valid token or API key provided",
  };
}

/**
 * Authorize request based on endpoint auth requirements
 */
export function authorizeRequest(
  authContext: AuthContext,
  endpointAuth: EndpointAuth
): { authorized: boolean; error?: string } {
  // If auth is not required, allow
  if (endpointAuth.required === false) {
    return { authorized: true };
  }

  // If auth is required (or not specified but roles are), check authentication
  if (endpointAuth.required === true || (endpointAuth.required === undefined && endpointAuth.roles)) {
    if (!authContext.authenticated) {
      return {
        authorized: false,
        error: "Authentication required",
      };
    }

    // Check roles if specified
    if (endpointAuth.roles && endpointAuth.roles.length > 0) {
      const userRoles = authContext.user?.roles || [];
      const hasRequiredRole = endpointAuth.roles.some((role) =>
        userRoles.includes(role)
      );

      if (!hasRequiredRole) {
        return {
          authorized: false,
          error: `Insufficient permissions. Required roles: ${endpointAuth.roles.join(", ")}`,
        };
      }
    }
  }

  return { authorized: true };
}

/**
 * Combined authenticate and authorize function
 */
export async function authenticateAndAuthorize(
  headers: Record<string, string | undefined>,
  authConfig: AuthConfig | undefined,
  endpointAuth: EndpointAuth | undefined
): Promise<{ context: AuthContext; authorized: boolean; error?: string }> {
  // If no auth config and no endpoint auth, allow
  if (!authConfig && !endpointAuth) {
    return {
      context: { authenticated: false },
      authorized: true,
    };
  }

  // If endpoint doesn't require auth, allow
  if (endpointAuth?.required === false) {
    return {
      context: { authenticated: false },
      authorized: true,
    };
  }

  // If auth is required but no config, deny
  if ((endpointAuth?.required === true || endpointAuth?.roles) && !authConfig) {
    return {
      context: { authenticated: false },
      authorized: false,
      error: "Authentication required but no auth configuration provided",
    };
  }

  // Authenticate
  if (!authConfig) {
    return {
      context: { authenticated: false },
      authorized: true,
    };
  }

  const authResult = await authenticateRequest(headers, authConfig);
  const authContext = authResult.context;

  // If authentication failed and it's required, deny
  if (!authContext.authenticated && (endpointAuth?.required === true || (endpointAuth?.required === undefined && endpointAuth?.roles))) {
    return {
      context: authContext,
      authorized: false,
      error: authResult.error || "Authentication failed",
    };
  }

  // Authorize
  if (endpointAuth) {
    const authzResult = authorizeRequest(authContext, endpointAuth);
    return {
      context: authContext,
      authorized: authzResult.authorized,
      error: authzResult.error,
    };
  }

  return {
    context: authContext,
    authorized: true,
  };
}

