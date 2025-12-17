/**
 * @yamajs/core - Auth Utilities
 *
 * Password hashing, verification, and strength checking utilities.
 */
import type { PasswordStrengthResult } from "./types.js";
/**
 * Hash a password using bcrypt.
 *
 * @param password - Plain text password to hash
 * @param saltRounds - Number of salt rounds (default: 12)
 * @returns Hashed password
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('mySecurePassword123');
 * // Store hash in database
 * ```
 */
export declare function hashPassword(password: string, saltRounds?: number): Promise<string>;
/**
 * Verify a password against a hash.
 *
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns true if password matches hash
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('mySecurePassword123', storedHash);
 * if (!isValid) {
 *   throw new AuthenticationError('Invalid password');
 * }
 * ```
 */
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
/**
 * Check password strength and provide feedback.
 *
 * Default requirements:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 *
 * @param password - Password to check
 * @param options - Custom requirements
 * @returns Password strength result with score and issues
 *
 * @example
 * ```typescript
 * const result = checkPasswordStrength('weak');
 * if (!result.valid) {
 *   throw new ValidationError('Password too weak', {
 *     details: result.issues.map(issue => ({ field: 'password', message: issue }))
 *   });
 * }
 * ```
 */
export declare function checkPasswordStrength(password: string, options?: PasswordStrengthOptions): PasswordStrengthResult;
/**
 * Options for password strength checking.
 */
export interface PasswordStrengthOptions {
    /** Minimum password length (default: 8) */
    minLength?: number;
    /** Maximum password length (default: 128) */
    maxLength?: number;
    /** Require at least one lowercase letter (default: true) */
    requireLowercase?: boolean;
    /** Require at least one uppercase letter (default: true) */
    requireUppercase?: boolean;
    /** Require at least one number (default: true) */
    requireNumbers?: boolean;
    /** Require at least one special character (default: false) */
    requireSpecial?: boolean;
}
/**
 * Generate a secure random token.
 * Useful for password reset tokens, email verification, etc.
 *
 * @param length - Token length in bytes (default: 32, produces 64 hex chars)
 * @returns Hex-encoded random token
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Generate a numeric OTP code.
 *
 * @param length - Number of digits (default: 6)
 * @returns Numeric OTP string
 */
export declare function generateOTP(length?: number): string;
/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export declare function secureCompare(a: string, b: string): boolean;
//# sourceMappingURL=utils.d.ts.map