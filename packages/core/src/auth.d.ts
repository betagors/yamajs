import { type AuthConfig, type EndpointAuth, type AuthContext } from "./schemas.js";
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
export declare function authenticateRequest(headers: Record<string, string | undefined>, authConfig: AuthConfig): Promise<AuthResultWithCode>;
/**
 * Authorize request based on endpoint auth requirements
 * Precedence: handler > permissions > roles > required
 */
export declare function authorizeRequest(authContext: AuthContext, endpointAuth: EndpointAuth, rolePermissions?: Record<string, string[]>, authHandler?: (authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean): Promise<AuthzResultWithCode>;
/**
 * Combined authenticate and authorize function
 */
export declare function authenticateAndAuthorize(headers: Record<string, string | undefined>, authConfig: AuthConfig | undefined, endpointAuth: EndpointAuth | undefined, authHandler?: (authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean): Promise<CombinedAuthResult>;
//# sourceMappingURL=auth.d.ts.map