import type { AuthProviderHandler, OAuthProviderMetadata } from "./types.js";

/**
 * Registry of auth providers by type
 */
const authProviders = new Map<string, AuthProviderHandler>();

/**
 * Registry of OAuth providers
 */
const oauthProviders = new Map<string, OAuthProviderMetadata>();

/**
 * Register an auth provider handler
 * @param type - Provider type (e.g., "jwt", "api-key", "basic", "oauth-google")
 * @param handler - Provider handler implementation
 */
export function registerAuthProvider(
  type: string,
  handler: AuthProviderHandler
): void {
  authProviders.set(type.toLowerCase(), handler);
}

/**
 * Get an auth provider handler by type
 * @param type - Provider type
 * @returns Provider handler or undefined if not found
 */
export function getAuthProvider(
  type: string
): AuthProviderHandler | undefined {
  return authProviders.get(type.toLowerCase());
}

/**
 * Register an OAuth provider
 * @param type - OAuth provider type (e.g., "oauth-google", "oauth-github")
 * @param metadata - OAuth provider metadata
 */
export function registerOAuthProvider(
  type: string,
  metadata: OAuthProviderMetadata
): void {
  oauthProviders.set(type.toLowerCase(), metadata);
}

/**
 * Get an OAuth provider by type
 * @param type - OAuth provider type
 * @returns OAuth provider metadata or undefined if not found
 */
export function getOAuthProvider(
  type: string
): OAuthProviderMetadata | undefined {
  return oauthProviders.get(type.toLowerCase());
}

/**
 * Get all registered OAuth providers
 * @returns Map of OAuth providers
 */
export function getAllOAuthProviders(): Map<string, OAuthProviderMetadata> {
  return new Map(oauthProviders);
}

/**
 * Get all registered auth provider types
 * @returns Array of provider types
 */
export function getRegisteredProviderTypes(): string[] {
  return Array.from(authProviders.keys());
}

