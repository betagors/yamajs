import type { SecurityHeadersConfig } from "./types.js";

/**
 * Response-like object for collecting headers
 */
export interface ResponseLike {
  statusCode?: number;
  headers: Record<string, string>;
  body?: unknown;
}

/**
 * Default security headers configuration
 */
const DEFAULT_HEADERS_CONFIG: SecurityHeadersConfig = {
  contentSecurityPolicy: "default-src 'self'",
  contentTypeNosniff: true,
  frameOptions: "DENY",
  xssProtection: "1; mode=block",
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false,
  },
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: "geolocation=(), microphone=(), camera=()",
  crossOriginEmbedderPolicy: "require-corp",
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
};

/**
 * Build Content-Security-Policy header
 */
function buildCSPHeader(csp: string | false | undefined): string | null {
  if (csp === false) {
    return null;
  }
  return csp || DEFAULT_HEADERS_CONFIG.contentSecurityPolicy || null;
}

/**
 * Build Strict-Transport-Security header
 */
function buildHSTSHeader(
  hsts: SecurityHeadersConfig["strictTransportSecurity"]
): string | null {
  if (hsts === false) {
    return null;
  }

  const config = hsts || DEFAULT_HEADERS_CONFIG.strictTransportSecurity;
  if (!config || typeof config === "boolean") {
    return null;
  }

  let header = `max-age=${config.maxAge || 31536000}`;
  if (config.includeSubDomains) {
    header += "; includeSubDomains";
  }
  if (config.preload) {
    header += "; preload";
  }

  return header;
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(
  response: ResponseLike,
  config: SecurityHeadersConfig = {}
): void {
  const headersConfig = { ...DEFAULT_HEADERS_CONFIG, ...config };

  // Content-Security-Policy
  const csp = buildCSPHeader(headersConfig.contentSecurityPolicy);
  if (csp) {
    response.headers["Content-Security-Policy"] = csp;
  }

  // X-Content-Type-Options
  if (headersConfig.contentTypeNosniff !== false) {
    response.headers["X-Content-Type-Options"] = "nosniff";
  }

  // X-Frame-Options
  if (headersConfig.frameOptions !== false) {
    response.headers["X-Frame-Options"] =
      headersConfig.frameOptions || "DENY";
  }

  // X-XSS-Protection
  if (headersConfig.xssProtection !== false) {
    const xssValue =
      typeof headersConfig.xssProtection === "string"
        ? headersConfig.xssProtection
        : "1; mode=block";
    response.headers["X-XSS-Protection"] = xssValue;
  }

  // Strict-Transport-Security
  const hsts = buildHSTSHeader(headersConfig.strictTransportSecurity);
  if (hsts) {
    response.headers["Strict-Transport-Security"] = hsts;
  }

  // Referrer-Policy
  if (headersConfig.referrerPolicy !== false) {
    response.headers["Referrer-Policy"] =
      headersConfig.referrerPolicy || "strict-origin-when-cross-origin";
  }

  // Permissions-Policy
  if (headersConfig.permissionsPolicy !== false) {
    response.headers["Permissions-Policy"] =
      headersConfig.permissionsPolicy ||
      "geolocation=(), microphone=(), camera=()";
  }

  // Cross-Origin-Embedder-Policy
  if (headersConfig.crossOriginEmbedderPolicy !== false) {
    const coepValue =
      typeof headersConfig.crossOriginEmbedderPolicy === "string"
        ? headersConfig.crossOriginEmbedderPolicy
        : "require-corp";
    response.headers["Cross-Origin-Embedder-Policy"] = coepValue;
  }

  // Cross-Origin-Opener-Policy
  if (headersConfig.crossOriginOpenerPolicy !== false) {
    response.headers["Cross-Origin-Opener-Policy"] =
      headersConfig.crossOriginOpenerPolicy || "same-origin";
  }

  // Cross-Origin-Resource-Policy
  if (headersConfig.crossOriginResourcePolicy !== false) {
    response.headers["Cross-Origin-Resource-Policy"] =
      headersConfig.crossOriginResourcePolicy || "same-origin";
  }
}

