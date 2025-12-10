/**
 * @betagors/yama-core - Auth Utilities
 * 
 * Password hashing, verification, and strength checking utilities.
 */

import type { PasswordStrengthResult } from "./types.js";
import { getCryptoProvider, getPasswordHasher } from "../platform/crypto.js";

// Default bcrypt cost factor
const DEFAULT_SALT_ROUNDS = 12;
const textEncoder = new TextEncoder();

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
export async function hashPassword(
  password: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): Promise<string> {
  const hasher = await getPasswordHasher();
  return hasher.hash(password, saltRounds);
}

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
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const hasher = await getPasswordHasher();
  return hasher.verify(password, hash);
}

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
export function checkPasswordStrength(
  password: string,
  options: PasswordStrengthOptions = {}
): PasswordStrengthResult {
  const {
    minLength = 8,
    requireLowercase = true,
    requireUppercase = true,
    requireNumbers = true,
    requireSpecial = false,
    maxLength = 128,
  } = options;

  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length checks
  if (password.length < minLength) {
    issues.push(`Password must be at least ${minLength} characters`);
  } else {
    score += 1;
  }

  if (password.length > maxLength) {
    issues.push(`Password must not exceed ${maxLength} characters`);
  }

  // Length bonus
  if (password.length >= 12) {
    score += 1;
    if (password.length >= 16) {
      score += 1;
    }
  } else {
    suggestions.push("Consider using a longer password (12+ characters)");
  }

  // Lowercase check
  if (requireLowercase && !/[a-z]/.test(password)) {
    issues.push("Password must contain at least one lowercase letter");
  } else if (/[a-z]/.test(password)) {
    score += 0.5;
  }

  // Uppercase check
  if (requireUppercase && !/[A-Z]/.test(password)) {
    issues.push("Password must contain at least one uppercase letter");
  } else if (/[A-Z]/.test(password)) {
    score += 0.5;
  }

  // Number check
  if (requireNumbers && !/[0-9]/.test(password)) {
    issues.push("Password must contain at least one number");
  } else if (/[0-9]/.test(password)) {
    score += 0.5;
  }

  // Special character check
  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    issues.push("Password must contain at least one special character");
  } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 0.5;
    if (!requireSpecial) {
      // Bonus for optional special chars
      score += 0.5;
    }
  } else if (!requireSpecial) {
    suggestions.push("Consider adding special characters for extra security");
  }

  // Common password patterns to avoid
  const commonPatterns = [
    /^password/i,
    /^123456/,
    /^qwerty/i,
    /^admin/i,
    /^letmein/i,
    /^welcome/i,
    /(.)\1{2,}/, // Repeated characters
    /^[a-z]+$/i, // Only letters
    /^[0-9]+$/, // Only numbers
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      issues.push("Password contains a common pattern that is easily guessed");
      score = Math.max(0, score - 1);
      break;
    }
  }

  // Cap score at 5
  score = Math.min(5, Math.round(score));

  return {
    valid: issues.length === 0,
    score,
    issues,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

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
export function generateSecureToken(length: number = 32): string {
  const crypto = getCryptoProvider();
  const bytes = crypto.randomBytes(length);
  return bytesToHex(bytes);
}

/**
 * Generate a numeric OTP code.
 * 
 * @param length - Number of digits (default: 6)
 * @returns Numeric OTP string
 */
export function generateOTP(length: number = 6): string {
  const crypto = getCryptoProvider();
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const randomNum = crypto.randomInt(min, max);
  return randomNum.toString().padStart(length, "0");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
  const crypto = getCryptoProvider();
  const aBytes = textEncoder.encode(a);
  const bBytes = textEncoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBytes, bBytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
