import {
  type AuthProvider,
  type AuthConfig,
  type EndpointAuth,
  type AuthContext,
} from "./schemas.js";
import { getAuthProvider } from "./auth/registry.js";
import { ErrorCodes } from "@betagors/yama-errors";

// Import built-in providers to trigger registration
import "./auth/providers/index.js";

/**
 * Auth result with error code for typed error handling
 */
export interface AuthResultWithCode {
  context: AuthContext;
  error?: string;
  errorCode?: string;
}

/**
 * Authorization result with error code
 */
export interface AuthzResultWithCode {
  authorized: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Combined auth result
 */
export interface CombinedAuthResult {
  context: AuthContext;
  authorized: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Authenticate request using configured providers
 */
export async function authenticateRequest(
  headers: Record<string, string | undefined>,
  authConfig: AuthConfig
): Promise<AuthResultWithCode> {
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
    errorCode: ErrorCodes.AUTH_REQUIRED,
  };
}

/**
 * Get all permissions for user's roles
 */
function getUserPermissions(
  userRoles: string[],
  rolePermissions?: Record<string, string[]>
): string[] {
  if (!rolePermissions) return [];
  
  const permissions = new Set<string>();
  for (const role of userRoles) {
    const rolePerms = rolePermissions[role] || [];
    for (const perm of rolePerms) {
      permissions.add(perm);
    }
  }
  return Array.from(permissions);
}

/**
 * Check if user permission matches required permission (supports wildcards)
 */
function matchesPermission(userPerm: string, required: string): boolean {
  // Exact match
  if (userPerm === required) return true;
  
  // Wildcard: user has "*" -> all permissions
  if (userPerm === "*") return true;
  
  // Wildcard: user has "posts:*" -> matches "posts:read", "posts:write", etc.
  if (userPerm.endsWith(":*")) {
    const prefix = userPerm.slice(0, -2);
    return required.startsWith(prefix + ":");
  }
  
  // Wildcard: required is "posts:*" -> matches user "posts:read"
  if (required.endsWith(":*")) {
    const prefix = required.slice(0, -2);
    return userPerm.startsWith(prefix + ":");
  }
  
  return false;
}

/**
 * Authorize request based on endpoint auth requirements
 * Precedence: handler > permissions > roles > required
 */
export async function authorizeRequest(
  authContext: AuthContext,
  endpointAuth: EndpointAuth,
  rolePermissions?: Record<string, string[]>,
  authHandler?: (authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean
): Promise<AuthzResultWithCode> {
  // If auth is not required, allow
  if (endpointAuth.required === false) {
    return { authorized: true };
  }

  // Priority 1: Custom handler (Phase 3)
  if (endpointAuth.handler && authHandler) {
    try {
      const result = authHandler(authContext);
      // Handle both sync and async handlers
      if (result instanceof Promise) {
        const resolved = await result;
        if (!resolved) {
          return {
            authorized: false,
            error: "Custom authorization handler denied access",
            errorCode: ErrorCodes.AUTHZ_HANDLER_DENIED,
          };
        }
        return { authorized: true };
      }
      if (!result) {
        return {
          authorized: false,
          error: "Custom authorization handler denied access",
          errorCode: ErrorCodes.AUTHZ_HANDLER_DENIED,
        };
      }
      return { authorized: true };
    } catch (error) {
      return {
        authorized: false,
        error: error instanceof Error ? error.message : "Custom authorization handler failed",
        errorCode: ErrorCodes.AUTHZ_HANDLER_DENIED,
      };
    }
  }

  // Priority 2: Permissions (Phase 2)
  if (endpointAuth.permissions && endpointAuth.permissions.length > 0) {
    if (!authContext.authenticated) {
      return {
        authorized: false,
        error: "Authentication required",
        errorCode: ErrorCodes.AUTH_REQUIRED,
      };
    }

    const userRoles = authContext.user?.roles || [];
    const userPermissions = getUserPermissions(userRoles, rolePermissions);
    
    const hasPermission = endpointAuth.permissions.some((required) =>
      userPermissions.some((userPerm) => matchesPermission(userPerm, required))
    );

    if (!hasPermission) {
      return {
        authorized: false,
        error: `Insufficient permissions. Required: ${endpointAuth.permissions.join(", ")}`,
        errorCode: ErrorCodes.AUTHZ_INSUFFICIENT_PERMISSION,
      };
    }
    
    return { authorized: true };
  }

  // Priority 3: Roles (Phase 1 - existing behavior)
  if (endpointAuth.roles && endpointAuth.roles.length > 0) {
    if (!authContext.authenticated) {
      return {
        authorized: false,
        error: "Authentication required",
        errorCode: ErrorCodes.AUTH_REQUIRED,
      };
    }

    const userRoles = authContext.user?.roles || [];
    const hasRequiredRole = endpointAuth.roles.some((role) =>
      userRoles.includes(role)
    );

    if (!hasRequiredRole) {
      return {
        authorized: false,
        error: `Insufficient permissions. Required roles: ${endpointAuth.roles.join(", ")}`,
        errorCode: ErrorCodes.AUTHZ_INSUFFICIENT_ROLE,
      };
    }
    
    return { authorized: true };
  }

  // Priority 4: Required flag
  if (endpointAuth.required === true) {
    if (!authContext.authenticated) {
      return {
        authorized: false,
        error: "Authentication required",
        errorCode: ErrorCodes.AUTH_REQUIRED,
      };
    }
    return { authorized: true };
  }

  return { authorized: true };
}

/**
 * Combined authenticate and authorize function
 */
export async function authenticateAndAuthorize(
  headers: Record<string, string | undefined>,
  authConfig: AuthConfig | undefined,
  endpointAuth: EndpointAuth | undefined,
  authHandler?: (authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean
): Promise<CombinedAuthResult> {
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

  // Extract role permissions mapping from authConfig
  const rolePermissions: Record<string, string[]> | undefined = authConfig?.roles
    ? Object.fromEntries(
        Object.entries(authConfig.roles).map(([role, config]) => [role, config.permissions])
      )
    : undefined;

  // Determine if authentication is required
  const requiresAuth = 
    endpointAuth?.required === true ||
    (endpointAuth?.roles !== undefined && endpointAuth.roles.length > 0) ||
    (endpointAuth?.permissions !== undefined && endpointAuth.permissions.length > 0) ||
    endpointAuth?.handler !== undefined;

  // If auth is required but no config, deny
  if (requiresAuth && !authConfig) {
    return {
      context: { authenticated: false },
      authorized: false,
      error: "Authentication required but no auth configuration provided",
      errorCode: ErrorCodes.CONFIG_MISSING,
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
  if (!authContext.authenticated && requiresAuth) {
    return {
      context: authContext,
      authorized: false,
      error: authResult.error || "Authentication failed",
      errorCode: authResult.errorCode || ErrorCodes.AUTH_REQUIRED,
    };
  }

  // Authorize
  if (endpointAuth) {
    const authzResult = await authorizeRequest(
      authContext,
      endpointAuth,
      rolePermissions,
      authHandler
    );
    return {
      context: authContext,
      authorized: authzResult.authorized,
      error: authzResult.error,
      errorCode: authzResult.errorCode,
    };
  }

  return {
    context: authContext,
    authorized: true,
  };
}

