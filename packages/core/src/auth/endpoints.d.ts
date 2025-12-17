/**
 * @yamajs/core - Auto-Generated Auth Endpoints
 *
 * This module provides builders for standard auth endpoints:
 * - POST /auth/login
 * - POST /auth/register
 * - GET /auth/me
 * - POST /auth/refresh
 * - POST /auth/logout
 * - POST /auth/forgot-password
 * - POST /auth/reset-password
 * - POST /auth/verify-email
 * - POST /auth/change-password
 */
import type { AuthEndpoint, AuthEndpointsConfig, AuthUserEntityConfig } from "./plugin-types.js";
import type { AuthUser, TokenPair } from "./types.js";
/**
 * Options for building auth endpoints
 */
export interface AuthEndpointBuilderOptions {
    /** Endpoint configuration from yama.yaml */
    config: AuthEndpointsConfig;
    /** User entity configuration */
    userEntity: AuthUserEntityConfig;
    /** Function to generate tokens */
    generateTokens: (user: AuthUser) => Promise<TokenPair>;
    /** Function to refresh tokens */
    refreshTokens?: (refreshToken: string) => Promise<TokenPair>;
    /** Function to send verification email */
    sendVerificationEmail?: (user: AuthUser, token: string) => Promise<void>;
    /** Function to send password reset email */
    sendPasswordResetEmail?: (user: AuthUser, token: string) => Promise<void>;
}
/**
 * Build all enabled auth endpoints based on configuration
 */
export declare function buildAuthEndpoints(options: AuthEndpointBuilderOptions): AuthEndpoint[];
/**
 * Get default auth endpoints configuration
 */
export declare function getDefaultAuthEndpointsConfig(): AuthEndpointsConfig;
//# sourceMappingURL=endpoints.d.ts.map