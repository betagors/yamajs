import type { AuthProviderHandler, OAuthProviderMetadata } from "./types.js";
/**
 * Register an auth provider handler
 * @param type - Provider type (e.g., "jwt", "api-key", "basic", "oauth-google")
 * @param handler - Provider handler implementation
 */
export declare function registerAuthProvider(type: string, handler: AuthProviderHandler): void;
/**
 * Get an auth provider handler by type
 * @param type - Provider type
 * @returns Provider handler or undefined if not found
 */
export declare function getAuthProvider(type: string): AuthProviderHandler | undefined;
/**
 * Register an OAuth provider
 * @param type - OAuth provider type (e.g., "oauth-google", "oauth-github")
 * @param metadata - OAuth provider metadata
 */
export declare function registerOAuthProvider(type: string, metadata: OAuthProviderMetadata): void;
/**
 * Get an OAuth provider by type
 * @param type - OAuth provider type
 * @returns OAuth provider metadata or undefined if not found
 */
export declare function getOAuthProvider(type: string): OAuthProviderMetadata | undefined;
/**
 * Get all registered OAuth providers
 * @returns Map of OAuth providers
 */
export declare function getAllOAuthProviders(): Map<string, OAuthProviderMetadata>;
/**
 * Get all registered auth provider types
 * @returns Array of provider types
 */
export declare function getRegisteredProviderTypes(): string[];
