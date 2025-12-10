/**
 * Registry of auth providers by type
 */
const authProviders = new Map();
/**
 * Registry of OAuth providers
 */
const oauthProviders = new Map();
/**
 * Register an auth provider handler
 * @param type - Provider type (e.g., "jwt", "api-key", "basic", "oauth-google")
 * @param handler - Provider handler implementation
 */
export function registerAuthProvider(type, handler) {
    authProviders.set(type.toLowerCase(), handler);
}
/**
 * Get an auth provider handler by type
 * @param type - Provider type
 * @returns Provider handler or undefined if not found
 */
export function getAuthProvider(type) {
    return authProviders.get(type.toLowerCase());
}
/**
 * Register an OAuth provider
 * @param type - OAuth provider type (e.g., "oauth-google", "oauth-github")
 * @param metadata - OAuth provider metadata
 */
export function registerOAuthProvider(type, metadata) {
    oauthProviders.set(type.toLowerCase(), metadata);
}
/**
 * Get an OAuth provider by type
 * @param type - OAuth provider type
 * @returns OAuth provider metadata or undefined if not found
 */
export function getOAuthProvider(type) {
    return oauthProviders.get(type.toLowerCase());
}
/**
 * Get all registered OAuth providers
 * @returns Map of OAuth providers
 */
export function getAllOAuthProviders() {
    return new Map(oauthProviders);
}
/**
 * Get all registered auth provider types
 * @returns Array of provider types
 */
export function getRegisteredProviderTypes() {
    return Array.from(authProviders.keys());
}
//# sourceMappingURL=registry.js.map