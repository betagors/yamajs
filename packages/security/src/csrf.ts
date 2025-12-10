import { createHash, randomBytes } from "node:crypto";
import type { CsrfConfig } from "./types.js";
import type { HttpRequest } from "@betagors/yama-core";

/**
 * Response-like object for collecting headers
 */
export interface ResponseLike {
  statusCode?: number;
  headers: Record<string, string>;
  body?: unknown;
}

/**
 * Default CSRF configuration
 */
const DEFAULT_CSRF_CONFIG: Required<Omit<CsrfConfig, "secret" | "excludePaths">> & {
  secret: string;
  excludePaths: string[];
} = {
  enabled: true,
  secret: "change-me-in-production",
  cookieName: "_csrf",
  headerName: "X-CSRF-Token",
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  },
  protectedMethods: ["POST", "PUT", "PATCH", "DELETE"],
  excludePaths: [],
};

/**
 * Generate CSRF token
 */
export function generateCsrfToken(secret: string): string {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256")
    .update(token + secret)
    .digest("hex");
  return `${token}.${hash}`;
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(token: string, secret: string): boolean {
  const [tokenPart, hashPart] = token.split(".");
  if (!tokenPart || !hashPart) {
    return false;
  }

  const expectedHash = createHash("sha256")
    .update(tokenPart + secret)
    .digest("hex");

  return hashPart === expectedHash;
}

/**
 * Check if path should be excluded from CSRF protection
 */
function isPathExcluded(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((excluded) => {
    if (excluded === path) {
      return true;
    }
    if (excluded.endsWith("*")) {
      return path.startsWith(excluded.slice(0, -1));
    }
    return false;
  });
}

/**
 * Get CSRF token from request
 */
function getCsrfTokenFromRequest(
  request: HttpRequest,
  headerName: string,
  cookieName: string
): string | null {
  // Try header first
  const headerToken =
    request.headers[headerName.toLowerCase()] ||
    request.headers[headerName];
  if (headerToken) {
    return Array.isArray(headerToken) ? headerToken[0] : headerToken;
  }

  // Try cookie
  const cookies = request.headers["cookie"] || request.headers["Cookie"];
  if (cookies) {
    const cookieString = Array.isArray(cookies) ? cookies[0] : cookies;
    const cookieMatch = cookieString.match(
      new RegExp(`${cookieName}=([^;]+)`)
    );
    if (cookieMatch) {
      return cookieMatch[1];
    }
  }

  return null;
}

/**
 * Validate CSRF token for request
 */
export function validateCsrfToken(
  request: HttpRequest,
  response: ResponseLike,
  config: CsrfConfig
): { valid: boolean; error?: string } {
  const csrfConfig = {
    ...DEFAULT_CSRF_CONFIG,
    ...config,
    cookieOptions: {
      ...DEFAULT_CSRF_CONFIG.cookieOptions,
      ...config.cookieOptions,
    },
  };

  if (!csrfConfig.enabled) {
    return { valid: true };
  }

  const method = request.method?.toUpperCase() || "";
  const path = request.url || "/";

  // Skip if method doesn't require protection
  if (!csrfConfig.protectedMethods.includes(method)) {
    return { valid: true };
  }

  // Skip if path is excluded
  if (isPathExcluded(path, csrfConfig.excludePaths)) {
    return { valid: true };
  }

  // Get token from request
  const token = getCsrfTokenFromRequest(
    request,
    csrfConfig.headerName,
    csrfConfig.cookieName
  );

  if (!token) {
    return {
      valid: false,
      error: "CSRF token missing",
    };
  }

  // Verify token
  if (!verifyCsrfToken(token, csrfConfig.secret)) {
    return {
      valid: false,
      error: "CSRF token invalid",
    };
  }

  return { valid: true };
}

/**
 * Set CSRF token cookie
 */
export function setCsrfTokenCookie(
  response: ResponseLike,
  config: CsrfConfig
): string {
  const csrfConfig = {
    ...DEFAULT_CSRF_CONFIG,
    ...config,
    cookieOptions: {
      ...DEFAULT_CSRF_CONFIG.cookieOptions,
      ...config.cookieOptions,
    },
  };

  const token = generateCsrfToken(csrfConfig.secret);
  const cookieOptions = csrfConfig.cookieOptions;

  let cookieString = `${csrfConfig.cookieName}=${token}`;
  if (cookieOptions.path) {
    cookieString += `; Path=${cookieOptions.path}`;
  }
  if (cookieOptions.httpOnly) {
    cookieString += "; HttpOnly";
  }
  if (cookieOptions.secure) {
    cookieString += "; Secure";
  }
  if (cookieOptions.sameSite) {
    cookieString += `; SameSite=${cookieOptions.sameSite}`;
  }

  response.headers["Set-Cookie"] = cookieString;

  return token;
}

