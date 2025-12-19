/**
 * Authentication utilities for YAMA Node Runtime
 * 
 * This module provides utilities for determining authentication requirements
 * for endpoints based on configuration.
 */

import type { EndpointDefinition, YamaConfig } from "./types.js";

/**
 * Determine if an endpoint requires authentication
 * 
 * Returns true if the endpoint needs authentication, false if it's public.
 * 
 * Authentication logic (in order of precedence):
 * 1. If `endpoint.auth.required === false`, it's explicitly public → return false
 * 2. If `endpoint.auth.required === true` or `endpoint.auth.roles` exists, it requires auth → return true
 * 3. If `endpoint.auth` exists (but no explicit required/roles), and `config.auth` exists → requires auth (default)
 * 4. If no `endpoint.auth` but `config.auth` exists → requires auth (default behavior when global auth is configured)
 * 5. If neither `endpoint.auth` nor `config.auth` exists → public endpoint
 * 
 * @param config - YAMA configuration
 * @param endpoint - Endpoint definition
 * @returns True if authentication is required, false otherwise
 * 
 * @remarks
 * - Endpoints can override global auth settings
 * - Explicit `required: false` takes highest priority
 * - When global auth is configured, endpoints default to requiring auth
 * 
 * @example
 * ```typescript
 * // Case 1: Explicitly public endpoint
 * needsAuthentication(config, {
 *   path: "/public",
 *   method: "GET",
 *   auth: { required: false }
 * });
 * // Returns: false
 * 
 * // Case 2: Endpoint requires specific roles
 * needsAuthentication(config, {
 *   path: "/admin",
 *   method: "GET",
 *   auth: { roles: ["admin"] }
 * });
 * // Returns: true
 * 
 * // Case 3: Global auth configured, no endpoint override
 * needsAuthentication(
 *   { auth: { providers: [...] } },
 *   { path: "/users", method: "GET" }
 * );
 * // Returns: true (defaults to requiring auth)
 * 
 * // Case 4: No auth configured anywhere
 * needsAuthentication(
 *   {},
 *   { path: "/public", method: "GET" }
 * );
 * // Returns: false
 * ```
 */
export function needsAuthentication(
  config: YamaConfig,
  endpoint: EndpointDefinition
): boolean {
  const endpointAuth = endpoint.auth;
  const configAuth = config.auth;

  // Case 1: Explicitly public endpoint (highest priority)
  if (endpointAuth?.required === false) {
    return false;
  }

  // Case 2: Explicitly requires auth (required === true, roles, permissions, or handler specified)
  if (
    endpointAuth?.required === true ||
    (endpointAuth?.roles && endpointAuth.roles.length > 0) ||
    (endpointAuth?.permissions && endpointAuth.permissions.length > 0) ||
    endpointAuth?.handler
  ) {
    return true;
  }

  // Case 3: Endpoint has auth config object but no explicit required flag
  // If global auth exists, default to requiring auth
  if (endpointAuth && configAuth) {
    return true;
  }

  // Case 4: No endpoint auth config but global auth exists
  // Default behavior: require auth when global auth is configured
  if (!endpointAuth && configAuth) {
    return true;
  }

  // Case 5: No auth configuration at all - public endpoint
  return false;
}
