/**
 * @betagors/yama-core - Auth Context Helpers
 * 
 * Factory functions to enhance AuthContext with permission helpers.
 */

import type { AuthContext } from "./types.js";

/**
 * Check if a user permission matches a required permission.
 * Supports wildcards:
 * - "*" matches everything
 * - "posts:*" matches "posts:read", "posts:write", etc.
 * - "posts:read" exact match
 * 
 * @param userPerm - Permission the user has
 * @param required - Permission required for access
 * @returns true if permission matches
 */
export function matchesPermission(userPerm: string, required: string): boolean {
  // Exact match
  if (userPerm === required) return true;
  
  // Wildcard: user has "*" -> all permissions
  if (userPerm === "*") return true;
  
  // Wildcard: user has "posts:*" -> matches "posts:read", "posts:write", etc.
  if (userPerm.endsWith(":*")) {
    const prefix = userPerm.slice(0, -2);
    // Match prefix exactly or with a colon separator
    return required === prefix || required.startsWith(prefix + ":");
  }
  
  return false;
}

/**
 * Get all permissions for a user based on their roles.
 * 
 * @param userRoles - Roles assigned to the user
 * @param rolePermissions - Mapping of roles to permissions
 * @returns Array of all permissions
 */
export function getRolePermissions(
  userRoles: string[],
  rolePermissions: Record<string, string[]>
): string[] {
  const permissions = new Set<string>();
  
  for (const role of userRoles) {
    const perms = rolePermissions[role];
    if (perms) {
      for (const perm of perms) {
        permissions.add(perm);
      }
    }
  }
  
  return Array.from(permissions);
}

/**
 * Create a permission checker function for a user.
 * 
 * @param userPermissions - Direct permissions assigned to the user
 * @param rolePermissions - Mapping of roles to permissions
 * @param userRoles - Roles assigned to the user
 * @returns Function that checks if user has a permission
 */
export function createPermissionChecker(
  userPermissions: string[],
  rolePermissions: Record<string, string[]>,
  userRoles: string[]
): (permission: string) => boolean {
  // Collect all permissions (direct + role-based)
  const allPermissions = new Set<string>(userPermissions);
  
  // Add permissions from roles
  for (const role of userRoles) {
    const perms = rolePermissions[role];
    if (perms) {
      for (const perm of perms) {
        allPermissions.add(perm);
      }
    }
  }
  
  // Return checker function
  return (permission: string): boolean => {
    // Check each permission for a match
    for (const userPerm of allPermissions) {
      if (matchesPermission(userPerm, permission)) {
        return true;
      }
    }
    return false;
  };
}

/**
 * Enhance an AuthContext with permission helper methods.
 * 
 * This function adds the following methods to the context:
 * - can(permission): Check if user has a specific permission
 * - hasRole(role): Check if user has a specific role
 * - canAny(permissions): Check if user has any of the permissions
 * - canAll(permissions): Check if user has all permissions
 * 
 * @param baseContext - Base auth context from authentication
 * @param rolePermissions - Mapping of roles to permissions from config
 * @returns Enhanced auth context with helper methods
 * 
 * @example
 * ```typescript
 * const enhancedAuth = enhanceAuthContext(authContext, {
 *   admin: ['*'],
 *   moderator: ['posts:*', 'comments:delete'],
 *   user: ['posts:read', 'posts:create'],
 * });
 * 
 * if (enhancedAuth.can?.('posts:delete')) {
 *   // User can delete posts
 * }
 * ```
 */
export function enhanceAuthContext(
  baseContext: AuthContext,
  rolePermissions: Record<string, string[]> = {}
): AuthContext {
  // If not authenticated, return context with no-op helpers
  if (!baseContext.authenticated) {
    return {
      ...baseContext,
      can: () => false,
      hasRole: () => false,
      canAny: () => false,
      canAll: () => false,
    };
  }
  
  const userRoles = baseContext.user?.roles || [];
  const userPermissions = baseContext.user?.permissions || [];
  
  // Create the permission checker
  const can = createPermissionChecker(userPermissions, rolePermissions, userRoles);
  
  return {
    ...baseContext,
    
    /**
     * Check if user has a specific permission.
     * Supports wildcards.
     */
    can,
    
    /**
     * Check if user has a specific role.
     */
    hasRole: (role: string): boolean => userRoles.includes(role),
    
    /**
     * Check if user has any of the specified permissions.
     */
    canAny: (permissions: string[]): boolean => 
      permissions.some(perm => can(perm)),
    
    /**
     * Check if user has all of the specified permissions.
     */
    canAll: (permissions: string[]): boolean =>
      permissions.every(perm => can(perm)),
  };
}

/**
 * Extract role permissions mapping from auth config.
 * 
 * @param authConfig - Auth configuration from yama.yaml
 * @returns Mapping of roles to permissions
 */
export function extractRolePermissions(
  authConfig?: { roles?: Record<string, { permissions: string[] }> }
): Record<string, string[]> {
  if (!authConfig?.roles) {
    return {};
  }
  
  return Object.fromEntries(
    Object.entries(authConfig.roles).map(([role, config]) => [role, config.permissions])
  );
}
