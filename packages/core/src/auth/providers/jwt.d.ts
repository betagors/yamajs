import type { AuthProviderHandler } from "../types.js";
import type { JwtAuthProvider, AuthContext } from "../../schemas.js";
export type JwtPayload = {
    [key: string]: any;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    exp?: number;
    nbf?: number;
    iat?: number;
    jti?: string;
};
/**
 * Extract token from Authorization header
 */
declare function extractBearerToken(authHeader?: string): string | null;
/**
 * Parse duration string to seconds
 * Supports: 15m, 1h, 7d, 30d, etc.
 */
declare function parseDuration(duration: string | number): number;
/**
 * Validate JWT token
 */
declare function validateJwt(token: string, provider: JwtAuthProvider): Promise<{
    valid: boolean;
    payload?: JwtPayload;
    error?: string;
    errorCode?: string;
}>;
/**
 * Create auth context from JWT payload
 */
declare function createAuthContextFromJwt(payload: JwtPayload, provider: string): AuthContext;
/**
 * JWT auth provider handler
 */
declare const jwtHandler: AuthProviderHandler;
export default jwtHandler;
export { validateJwt, extractBearerToken, createAuthContextFromJwt, parseDuration };
//# sourceMappingURL=jwt.d.ts.map