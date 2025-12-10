import type { AuthContext, AuthProvider } from "../schemas.js";
/**
 * Result of authentication validation
 */
export interface AuthResult {
    valid: boolean;
    context: AuthContext;
    error?: string;
}
/**
 * Handler interface for auth providers
 */
export interface AuthProviderHandler {
    /**
     * Validate authentication from request headers
     * @param headers - Request headers
     * @param config - Provider configuration
     * @returns Authentication result
     */
    validate(headers: Record<string, string | undefined>, config: AuthProvider): Promise<AuthResult>;
    /**
     * Extract token/credential from headers (optional, for token-based auth)
     * @param headers - Request headers
     * @returns Extracted token or null
     */
    extractToken?(headers: Record<string, string | undefined>): string | null;
}
/**
 * OAuth provider metadata
 */
export interface OAuthProviderMetadata {
    name: string;
    autoGenerateEndpoints?: boolean;
    redirectUri?: string;
    callbackPath?: string;
    handleOAuthFlow?: (request: unknown, reply: unknown) => Promise<unknown>;
}
