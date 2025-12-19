/**
 * CORS configuration options
 */
export interface CorsConfig {
  /** Allowed origins (use '*' for all, or specific origins) */
  origins?: string[] | "*";
  /** Allowed HTTP methods */
  methods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Whether to allow credentials */
  credentials?: boolean;
  /** Max age for preflight requests in seconds */
  maxAge?: number;
}

/**
 * CSRF protection configuration
 */
export interface CsrfConfig {
  /** Whether CSRF protection is enabled */
  enabled?: boolean;
  /** Secret key for CSRF token generation */
  secret?: string;
  /** Cookie name for CSRF token */
  cookieName?: string;
  /** Header name for CSRF token */
  headerName?: string;
  /** Cookie options */
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    path?: string;
  };
  /** Methods that require CSRF protection */
  protectedMethods?: string[];
  /** Paths to exclude from CSRF protection */
  excludePaths?: string[];
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy */
  contentSecurityPolicy?: string | false;
  /** X-Content-Type-Options */
  contentTypeNosniff?: boolean;
  /** X-Frame-Options */
  frameOptions?: "DENY" | "SAMEORIGIN" | false;
  /** X-XSS-Protection */
  xssProtection?: boolean | string;
  /** Strict-Transport-Security (HSTS) */
  strictTransportSecurity?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  } | false;
  /** Referrer-Policy */
  referrerPolicy?: string | false;
  /** Permissions-Policy */
  permissionsPolicy?: string | false;
  /** Cross-Origin-Embedder-Policy */
  crossOriginEmbedderPolicy?: boolean | string;
  /** Cross-Origin-Opener-Policy */
  crossOriginOpenerPolicy?: string | false;
  /** Cross-Origin-Resource-Policy */
  crossOriginResourcePolicy?: string | false;
}

/**
 * Input sanitization configuration
 */
export interface SanitizationConfig {
  /** Whether sanitization is enabled */
  enabled?: boolean;
  /** Sanitize HTML in input */
  sanitizeHtml?: boolean;
  /** Sanitize SQL injection patterns */
  sanitizeSql?: boolean;
  /** Sanitize XSS patterns */
  sanitizeXss?: boolean;
  /** Maximum string length */
  maxStringLength?: number;
  /** Fields/paths to exclude from sanitization */
  excludePaths?: string[];
}

/**
 * Security plugin configuration
 */
export interface SecurityPluginConfig {
  /** CORS configuration */
  cors?: CorsConfig | false;
  /** CSRF protection configuration */
  csrf?: CsrfConfig | false;
  /** Security headers configuration */
  headers?: SecurityHeadersConfig | false;
  /** Input sanitization configuration */
  sanitization?: SanitizationConfig | false;
}



















