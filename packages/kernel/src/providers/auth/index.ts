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
    RateLimitResult,
    RateLimitConfig,
} from '../types.js';

// Re-export adapter utilities
export {
    JWTPasswordAuthProvider,
    JWTPasswordAuthAPI,
    createJWT,
    verifyJWT,
    hashPassword,
    verifyPassword,
    validatePasswordStrength,
    checkPasswordBreached,
} from './adapters/jwt-password.js';

// Register adapters (side effect)
import './adapters/jwt-password.js';
