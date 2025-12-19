/**
 * Auth Provider
 * 
 * Provides authentication and authorization with JWT and password.
 */

// Re-export types
export type {
    AuthProviderConfig,
    AuthAPI,
    JWTPayload,
    RefreshTokenPayload,
    TokenPair,
    Session,
    PasswordValidationResult,
} from './types.js';

// Adapters are now in separate packages (e.g. @yamajs/auth-jwt-password)
