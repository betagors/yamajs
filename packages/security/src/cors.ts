import type { CorsConfig } from "./types.js";
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
 * Default CORS configuration
 */
const DEFAULT_CORS_CONFIG: Required<CorsConfig> = {
  origins: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400, // 24 hours
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[] | "*"
): boolean {
  if (allowedOrigins === "*") {
    return true;
  }
  if (!origin) {
    return false;
  }
  return allowedOrigins.includes(origin);
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflight(
  request: HttpRequest,
  response: ResponseLike,
  config: CorsConfig
): boolean {
  if (request.method !== "OPTIONS") {
    return false;
  }

  const corsConfig = { ...DEFAULT_CORS_CONFIG, ...config };
  const origin = request.headers["origin"] || request.headers["Origin"];

  if (!isOriginAllowed(origin as string, corsConfig.origins)) {
    response.statusCode = 403;
    return true;
  }

  // Set CORS headers
  if (origin) {
    response.headers["Access-Control-Allow-Origin"] = origin as string;
  }
  response.headers["Access-Control-Allow-Methods"] =
    corsConfig.methods.join(", ");
  response.headers["Access-Control-Allow-Headers"] =
    corsConfig.allowedHeaders.join(", ");

  if (corsConfig.exposedHeaders.length > 0) {
    response.headers["Access-Control-Expose-Headers"] =
      corsConfig.exposedHeaders.join(", ");
  }

  if (corsConfig.credentials) {
    response.headers["Access-Control-Allow-Credentials"] = "true";
  }

  if (corsConfig.maxAge) {
    response.headers["Access-Control-Max-Age"] = String(corsConfig.maxAge);
  }

  response.statusCode = 204;
  return true;
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  request: HttpRequest,
  response: ResponseLike,
  config: CorsConfig
): void {
  const corsConfig = { ...DEFAULT_CORS_CONFIG, ...config };
  const origin = request.headers["origin"] || request.headers["Origin"];

  if (!isOriginAllowed(origin as string, corsConfig.origins)) {
    return;
  }

  // Set CORS headers
  if (origin) {
    response.headers["Access-Control-Allow-Origin"] = origin as string;
  }

  if (corsConfig.credentials) {
    response.headers["Access-Control-Allow-Credentials"] = "true";
  }

  if (corsConfig.exposedHeaders.length > 0) {
    response.headers["Access-Control-Expose-Headers"] =
      corsConfig.exposedHeaders.join(", ");
  }
}

