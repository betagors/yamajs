import {
  type AuthProvider,
  type AuthConfig,
  type EndpointAuth,
  type AuthContext,
} from "./schemas.js";
import { getAuthProvider } from "./auth/registry.js";

// Import built-in providers to trigger registration
import "./auth/providers/index.js";

/**
 * Authenticate request using configured providers
 */
export async function authenticateRequest(
  headers: Record<string, string | undefined>,
  authConfig: AuthConfig
): Promise<{ context: AuthContext; error?: string }> {
  // Try each provider in order
  for (const provider of authConfig.providers) {
    const handler = getAuthProvider(provider.type);
    
    if (!handler) {
      // Provider type not registered - skip and continue to next
      continue;
    }

    // Validate using the provider handler
    const result = await handler.validate(headers, provider);
    
    if (result.valid) {
      return {
        context: result.context,
      };
    }
    
    // Continue to next provider if validation fails
  }

  // No provider succeeded
  return {
    context: { authenticated: false },
    error: "Authentication failed: no valid credentials provided",
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

