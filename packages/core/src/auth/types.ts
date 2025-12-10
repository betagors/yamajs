import type { AuthProvider } from "../schemas.js";

// =============================================================================
// Core Auth Types (v1 Stable Interface)
// =============================================================================

/**
 * User information from authentication.
 * This interface is extensible - plugins can add custom fields.
 */
export interface AuthUser {
  /** Unique user identifier */
  id?: string;
  /** User's email address */
  email?: string;
  /** User's display name */
  name?: string;
  /** Roles assigned to the user */
  roles?: string[];
  /** Direct permissions (not derived from roles) */
  permissions?: string[];
  /** Whether the user's email has been verified */
  emailVerified?: boolean;
  /** Avatar/profile picture URL */
  avatarUrl?: string;
  /** Allow additional properties from plugins */
  [key: string]: unknown;
}

/**
 * Session information (populated by session plugin)
 */
export interface SessionInfo {
  /** Session identifier */
  id: string;
  /** When the session expires */
  expiresAt?: Date;
  /** Session data storage */
  data?: Record<string, unknown>;
  /** Whether this is a new session */
  isNew?: boolean;
}

/**
 * MFA status information (populated by MFA plugin)
 */
export interface MfaInfo {
  /** Whether MFA has been verified for this session */
  verified: boolean;
  /** Whether MFA is required for this user */
  required: boolean;
  /** Available MFA methods for this user */
  methods: ('totp' | 'sms' | 'email' | 'passkey' | 'backup')[];
  /** Pending MFA challenge token (for step-up auth) */
  challengeToken?: string;
}

/**
 * OAuth information (populated by OAuth plugin)
 */
export interface OAuthInfo {
  /** OAuth provider name (e.g., "google", "github") */
  provider: string;
  /** Provider-specific user ID */
  providerId: string;
  /** OAuth access token (if available) */
  accessToken?: string;
  /** OAuth refresh token (if available) */
  refreshToken?: string;
  /** Token expiration time */
  expiresAt?: Date;
  /** OAuth scopes granted */
  scopes?: string[];
}

/**
 * Authentication context available in handlers.
 * 
 * This is the primary interface for auth state in Yama.
 * Plugins extend this context with additional fields.
 * 
 * @example
 * ```typescript
 * export async function handler(context: HandlerContext) {
 *   if (!context.auth?.authenticated) {
 *     return context.status(401).send({ error: "Unauthorized" });
 *   }
 *   
 *   if (!context.auth.can?.("posts:delete")) {
 *     return context.status(403).send({ error: "Forbidden" });
 *   }
 *   
 *   // User is authenticated and has permission
 *   const userId = context.auth.user?.id;
 * }
 * ```
 */
export interface AuthContext {
  /** Whether the request is authenticated */
  authenticated: boolean;
  
  /** User information (if authenticated) */
  user?: AuthUser;
  
  /** Auth provider that authenticated this request (e.g., "jwt", "api-key", "oauth-google") */
  provider?: string;
  
  /** Raw token/credential used for authentication */
  token?: string;
  
  // ==========================================================================
  // Permission Helpers (populated by auth middleware)
  // ==========================================================================
  
  /**
   * Check if user has a specific permission.
   * Supports wildcards (e.g., "posts:*" matches "posts:read").
   * 
   * @param permission - Permission to check (e.g., "posts:read", "users:delete")
   * @returns true if user has permission
   */
  can?: (permission: string) => boolean;
  
  /**
   * Check if user has a specific role.
   * 
   * @param role - Role to check (e.g., "admin", "moderator")
   * @returns true if user has role
   */
  hasRole?: (role: string) => boolean;
  
  /**
   * Check if user has any of the specified permissions.
   * 
   * @param permissions - Array of permissions to check
   * @returns true if user has at least one permission
   */
  canAny?: (permissions: string[]) => boolean;
  
  /**
   * Check if user has all of the specified permissions.
   * 
   * @param permissions - Array of permissions to check
   * @returns true if user has all permissions
   */
  canAll?: (permissions: string[]) => boolean;
  
  // ==========================================================================
  // Plugin Extension Points
  // ==========================================================================
  
  /** Session info (populated by @betagors/yama-session plugin) */
  session?: SessionInfo;
  
  /** MFA status (populated by @betagors/yama-mfa plugin) */
  mfa?: MfaInfo;
  
  /** OAuth info (populated by @betagors/yama-oauth plugin) */
  oauth?: OAuthInfo;
}

// =============================================================================
// Token Types
// =============================================================================

/**
 * Token pair returned from authentication/refresh operations.
 */
export interface TokenPair {
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token (optional, depends on config) */
  refreshToken?: string;
  /** Access token expiration in seconds */
  expiresIn: number;
  /** Refresh token expiration in seconds (if refresh token provided) */
  refreshExpiresIn?: number;
  /** Token type (always "bearer" for JWT) */
  tokenType: 'bearer' | 'cookie';
}

/**
 * Options for token generation.
 */
export interface TokenGenerationOptions {
  /** Access token expiration (e.g., "15m", "1h", or seconds) */
  accessTokenExpiresIn?: string | number;
  /** Refresh token expiration (e.g., "7d", "30d", or seconds) */
  refreshTokenExpiresIn?: string | number;
  /** Token issuer (iss claim) */
  issuer?: string;
  /** Token audience (aud claim) */
  audience?: string;
  /** Additional claims to include in the token */
  additionalClaims?: Record<string, unknown>;
}

// =============================================================================
// Auth Provider Types
// =============================================================================

/**
 * Result of authentication validation.
 */
export interface AuthResult {
  /** Whether authentication was successful */
  valid: boolean;
  /** Auth context (populated if valid) */
  context: AuthContext;
  /** Error message (if not valid) */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: string;
}

/**
 * Handler interface for auth providers.
 * 
 * Implement this interface to create custom auth providers.
 * Register with `registerAuthProvider(type, handler)`.
 * 
 * @example
 * ```typescript
 * const customHandler: AuthProviderHandler = {
 *   async validate(headers, config) {
 *     const token = headers['x-custom-token'];
 *     if (!token) {
 *       return { valid: false, context: { authenticated: false }, error: "No token" };
 *     }
 *     // Validate token...
 *     return { valid: true, context: { authenticated: true, user: { id: "..." } } };
 *   }
 * };
 * registerAuthProvider('custom', customHandler);
 * ```
 */
export interface AuthProviderHandler {
  /**
   * Validate authentication from request headers.
   * 
   * @param headers - Request headers (lowercase keys)
   * @param config - Provider configuration from yama.yaml
   * @returns Authentication result
   */
  validate(
    headers: Record<string, string | undefined>,
    config: AuthProvider
  ): Promise<AuthResult>;

  /**
   * Extract token/credential from headers (optional).
   * Used for token-based auth providers.
   * 
   * @param headers - Request headers
   * @returns Extracted token or null
   */
  extractToken?(headers: Record<string, string | undefined>): string | null;
  
  /**
   * Generate new tokens for a user.
   * Required for auth providers that support token generation (e.g., JWT).
   * 
   * @param user - User to generate tokens for
   * @param config - Provider configuration
   * @param options - Token generation options
   * @returns Token pair
   */
  generateTokens?(
    user: AuthUser,
    config: AuthProvider,
    options?: TokenGenerationOptions
  ): Promise<TokenPair>;
  
  /**
   * Refresh tokens using a refresh token.
   * 
   * @param refreshToken - Refresh token to use
   * @param config - Provider configuration
   * @returns New token pair
   */
  refreshTokens?(
    refreshToken: string,
    config: AuthProvider
  ): Promise<TokenPair>;
  
  /**
   * Revoke a token (logout).
   * 
   * @param token - Token to revoke
   * @param config - Provider configuration
   */
  revokeToken?(
    token: string,
    config: AuthProvider
  ): Promise<void>;
}

// =============================================================================
// OAuth Types
// =============================================================================

/**
 * OAuth provider metadata for registration.
 */
export interface OAuthProviderMetadata {
  /** Provider display name */
  name: string;
  /** Whether to auto-generate OAuth endpoints */
  autoGenerateEndpoints?: boolean;
  /** OAuth redirect URI */
  redirectUri?: string;
  /** Callback path (e.g., "/auth/google/callback") */
  callbackPath?: string;
  /** Custom OAuth flow handler */
  handleOAuthFlow?: (request: unknown, reply: unknown) => Promise<unknown>;
}

// =============================================================================
// Password Strength Types
// =============================================================================

/**
 * Result of password strength check.
 */
export interface PasswordStrengthResult {
  /** Whether password meets minimum requirements */
  valid: boolean;
  /** Strength score (0-5, higher is stronger) */
  score: number;
  /** Issues found with the password */
  issues: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
}
