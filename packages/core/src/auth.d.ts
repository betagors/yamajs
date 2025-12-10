import { type AuthConfig, type EndpointAuth, type AuthContext } from "./schemas.js";
import "./auth/providers/index.js";
/**
 * Authenticate request using configured providers
 */
export declare function authenticateRequest(headers: Record<string, string | undefined>, authConfig: AuthConfig): Promise<{
    context: AuthContext;
    error?: string;
}>;
/**
 * Authorize request based on endpoint auth requirements
 * Precedence: handler > permissions > roles > required
 */
export declare function authorizeRequest(authContext: AuthContext, endpointAuth: EndpointAuth, rolePermissions?: Record<string, string[]>, authHandler?: (authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean): Promise<{
    authorized: boolean;
    error?: string;
}>;
/**
 * Combined authenticate and authorize function
 */
export declare function authenticateAndAuthorize(headers: Record<string, string | undefined>, authConfig: AuthConfig | undefined, endpointAuth: EndpointAuth | undefined, authHandler?: (authContext: AuthContext, ...args: unknown[]) => Promise<boolean> | boolean): Promise<{
    context: AuthContext;
    authorized: boolean;
    error?: string;
}>;
