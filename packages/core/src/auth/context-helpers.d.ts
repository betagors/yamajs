/**
 * @yamajs/core - Auth Context Helpers
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
export declare function matchesPermission(userPerm: string, required: string): boolean;
/**
 * Get all permissions for a user based on their roles.
 *
 * @param userRoles - Roles assigned to the user
 * @param rolePermissions - Mapping of roles to permissions
 * @returns Array of all permissions
 */
export declare function getRolePermissions(userRoles: string[], rolePermissions: Record<string, string[]>): string[];
/**
 * Create a permission checker function for a user.
 *
 * @param userPermissions - Direct permissions assigned to the user
 * @param rolePermissions - Mapping of roles to permissions
 * @param userRoles - Roles assigned to the user
 * @returns Function that checks if user has a permission
 */
export declare function createPermissionChecker(userPermissions: string[], rolePermissions: Record<string, string[]>, userRoles: string[]): (permission: string) => boolean;
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
export declare function enhanceAuthContext(baseContext: AuthContext, rolePermissions?: Record<string, string[]>): AuthContext;
/**
 * Extract role permissions mapping from auth config.
 *
 * @param authConfig - Auth configuration from yama.yaml
 * @returns Mapping of roles to permissions
 */
export declare function extractRolePermissions(authConfig?: {
    roles?: Record<string, {
        permissions: string[];
    }>;
}): Record<string, string[]>;
//# sourceMappingURL=context-helpers.d.ts.map