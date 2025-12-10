/**
 * @betagors/yama-core - Auth Plugin Types
 * 
 * This module defines the standard interface for auth plugins.
 * All auth plugins (session, oauth, mfa, passkeys, etc.) implement this interface.
 */

import type { AuthContext, AuthProviderHandler, AuthUser } from "./types.js";
import type { MiddlewareDefinition, MiddlewareHandler } from "../middleware/types.js";

// =============================================================================
// Auth Plugin Types
// =============================================================================

/**
 * Auth plugin category.
 * Used for organization and to determine plugin capabilities.
 */
export type AuthPluginType = 
  | 'identity'       // Provides identity verification (OAuth, Passkeys, etc.)
  | 'session'        // Provides session management
  | 'authorization'  // Provides authorization logic (RBAC, ABAC, etc.)
  | 'provider'       // External auth provider integration (Clerk, Auth0, etc.)
  | 'mfa'            // Multi-factor authentication
  | 'utility';       // Utility plugins (password strength, etc.)

/**
 * Auth endpoint definition for plugins to register custom endpoints.
 */
export interface AuthEndpoint {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Endpoint path (relative to auth prefix, e.g., "/login", "/oauth/google") */
  path: string;
  /** Endpoint handler */
  handler: AuthEndpointHandler;
  /** Auth requirements for this endpoint (defaults to no auth required) */
  auth?: {
    required?: boolean;
    roles?: string[];
    permissions?: string[];
  };
  /** Rate limit configuration */
  rateLimit?: {
    window: string;  // e.g., "15m", "1h"
    max: number;
  };
  /** Request body schema (for validation) */
  bodySchema?: Record<string, unknown>;
  /** Response schema (for documentation) */
  responseSchema?: Record<string, unknown>;
  /** Endpoint description (for documentation) */
  description?: string;
}

/**
 * Auth endpoint handler function.
 */
export type AuthEndpointHandler = (
  context: AuthEndpointContext
) => Promise<AuthEndpointResponse> | AuthEndpointResponse;

/**
 * Context passed to auth endpoint handlers.
 */
export interface AuthEndpointContext {
  /** Request body (parsed JSON) */
  body: unknown;
  /** Query parameters */
  query: Record<string, string | string[] | undefined>;
  /** Path parameters */
  params: Record<string, string>;
  /** Request headers */
  headers: Record<string, string | undefined>;
  /** Auth context (if authenticated) */
  auth?: AuthContext;
  /** Database access (if available) */
  db?: unknown;
  /** Get user by email */
  getUserByEmail?: (email: string) => Promise<AuthUser | null>;
  /** Get user by ID */
  getUserById?: (id: string) => Promise<AuthUser | null>;
  /** Create user */
  createUser?: (user: Partial<AuthUser> & { password?: string }) => Promise<AuthUser>;
  /** Update user */
  updateUser?: (id: string, updates: Partial<AuthUser>) => Promise<AuthUser>;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Response from auth endpoint handlers.
 */
export interface AuthEndpointResponse {
  /** HTTP status code */
  status: number;
  /** Response body */
  body: unknown;
  /** Response headers */
  headers?: Record<string, string>;
  /** Cookies to set */
  cookies?: Array<{
    name: string;
    value: string;
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      maxAge?: number;
      path?: string;
      domain?: string;
    };
  }>;
}

/**
 * Configuration for auth plugin initialization.
 */
export interface AuthPluginConfig {
  /** Full Yama configuration */
  yamaConfig: Record<string, unknown>;
  /** Plugin-specific configuration */
  pluginConfig: Record<string, unknown>;
  /** Project directory */
  projectDir: string;
  /** Logger instance */
  logger: AuthPluginLogger;
}

/**
 * Logger interface for auth plugins.
 */
export interface AuthPluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

/**
 * Auth plugin interface.
 * 
 * All auth plugins must implement this interface.
 * This provides a standardized way for Yama to integrate auth functionality.
 * 
 * @example
 * ```typescript
 * const sessionPlugin: AuthPlugin = {
 *   name: '@betagors/yama-session',
 *   type: 'session',
 *   version: '1.0.0',
 *   
 *   async initialize(config) {
 *     // Set up session store
 *   },
 *   
 *   registerProviders() {
 *     // Register session auth provider
 *     registerAuthProvider('session', sessionHandler);
 *   },
 *   
 *   getMiddleware() {
 *     return [{
 *       name: 'session',
 *       handler: sessionMiddleware,
 *       phases: ['pre-auth'],
 *       priority: 10,
 *     }];
 *   },
 *   
 *   extendContext(context) {
 *     return {
 *       ...context,
 *       session: {
 *         id: '...',
 *         get: (key) => sessionData[key],
 *         set: (key, value) => { sessionData[key] = value; },
 *       },
 *     };
 *   },
 * };
 * ```
 */
export interface AuthPlugin {
  /** Plugin name (usually package name) */
  name: string;
  
  /** Plugin type/category */
  type: AuthPluginType;
  
  /** Plugin version */
  version?: string;
  
  /**
   * Initialize the plugin with configuration.
   * Called once when the plugin is loaded.
   * 
   * @param config - Plugin configuration
   */
  initialize(config: AuthPluginConfig): Promise<void>;
  
  /**
   * Register auth providers.
   * Called after initialize to register custom auth providers.
   */
  registerProviders?(): void;
  
  /**
   * Get custom endpoints to register.
   * These endpoints are automatically registered under the auth prefix.
   * 
   * @returns Array of endpoint definitions
   */
  getEndpoints?(): AuthEndpoint[];
  
  /**
   * Get middleware to register.
   * 
   * @returns Array of middleware definitions
   */
  getMiddleware?(): MiddlewareDefinition[];
  
  /**
   * Extend the auth context with plugin-specific data.
   * Called during request processing to add plugin data to context.
   * 
   * @param context - Current auth context
   * @param request - Raw request object
   * @returns Extended auth context
   */
  extendContext?(
    context: AuthContext,
    request: unknown
  ): AuthContext | Promise<AuthContext>;
  
  /**
   * Clean up resources on shutdown.
   * Called when the server is shutting down.
   */
  shutdown?(): Promise<void>;
  
  /**
   * Health check for the plugin.
   * Used by health monitoring to verify plugin is working.
   */
  healthCheck?(): Promise<{
    healthy: boolean;
    details?: Record<string, unknown>;
    error?: string;
  }>;
}

// =============================================================================
// Auth Plugin Registry Types
// =============================================================================

/**
 * Registration options for auth plugins.
 */
export interface AuthPluginRegistrationOptions {
  /** Override existing plugin with same name */
  override?: boolean;
  /** Plugin priority (lower = earlier initialization) */
  priority?: number;
}

/**
 * Registered auth plugin with metadata.
 */
export interface RegisteredAuthPlugin {
  plugin: AuthPlugin;
  options: AuthPluginRegistrationOptions;
  initialized: boolean;
  initError?: Error;
}

// =============================================================================
// Auth Endpoint Builder Types
// =============================================================================

/**
 * Standard auth endpoint configurations.
 * Used by auto-generated auth endpoints.
 */
export interface AuthEndpointsConfig {
  /** Enable/disable all auth endpoints */
  enabled: boolean;
  /** Base path prefix (default: "/auth") */
  prefix?: string;
  
  /** Login endpoint config */
  login?: boolean | {
    enabled?: boolean;
    path?: string;
    rateLimit?: { window: string; max: number };
  };
  
  /** Register endpoint config */
  register?: boolean | {
    enabled?: boolean;
    path?: string;
    requireEmailVerification?: boolean;
    rateLimit?: { window: string; max: number };
    /** Default role for new users */
    defaultRole?: string;
  };
  
  /** Get current user endpoint config */
  me?: boolean | {
    enabled?: boolean;
    path?: string;
  };
  
  /** Token refresh endpoint config */
  refresh?: boolean | {
    enabled?: boolean;
    path?: string;
    rateLimit?: { window: string; max: number };
  };
  
  /** Logout endpoint config */
  logout?: boolean | {
    enabled?: boolean;
    path?: string;
  };
  
  /** Password reset request endpoint config */
  forgotPassword?: boolean | {
    enabled?: boolean;
    path?: string;
    tokenExpiry?: string;
    rateLimit?: { window: string; max: number };
  };
  
  /** Password reset endpoint config */
  resetPassword?: boolean | {
    enabled?: boolean;
    path?: string;
  };
  
  /** Email verification endpoint config */
  verifyEmail?: boolean | {
    enabled?: boolean;
    path?: string;
  };
  
  /** Change password endpoint config (for authenticated users) */
  changePassword?: boolean | {
    enabled?: boolean;
    path?: string;
  };
}

/**
 * User entity configuration for auth endpoints.
 */
export interface AuthUserEntityConfig {
  /** Entity name (e.g., "User") */
  entity: string;
  /** Field mappings */
  fields?: {
    id?: string;
    email?: string;
    password?: string;
    roles?: string;
    emailVerified?: string;
    name?: string;
  };
}
