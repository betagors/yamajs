import type { HttpRequest } from "@betagors/yama-core";
// Note: These types are exported from @betagors/yama-core but may need to be imported
// from source during development. Once core is built, use: import type { MiddlewareHandler, MiddlewareContext } from "@betagors/yama-core";
import type { 
  MiddlewareHandler, 
  MiddlewareContext
} from "../../core/src/middleware/index.js";
import type { SecurityPluginConfig } from "./types.js";
import { handleCorsPreflight, applyCorsHeaders } from "./cors.js";
import { validateCsrfToken, setCsrfTokenCookie } from "./csrf.js";
import { applySecurityHeaders } from "./headers.js";
import { sanitizeRequestData } from "./sanitization.js";

/**
 * Response-like object for collecting headers
 */
interface ResponseLike {
  statusCode?: number;
  headers: Record<string, string>;
  body?: unknown;
}

/**
 * Create security middleware handler
 */
export function createSecurityMiddleware(
  config: SecurityPluginConfig
): MiddlewareHandler {
  return async (context: MiddlewareContext, next: () => Promise<void>) => {
    // Create request object from context
    // Use type assertions since MiddlewareContext extends HandlerContext
    const request: HttpRequest = {
      method: context.method as string,
      url: context.url as string,
      path: context.path as string,
      query: context.query as Record<string, unknown>,
      params: context.params as Record<string, unknown>,
      body: context.body,
      headers: context.headers as Record<string, string | undefined>,
    };

    // Create a response-like object to collect headers
    // Headers will be stored in context for runtime to apply
    const responseHeaders: Record<string, string> = {};
    const response: ResponseLike = {
      statusCode: 200,
      headers: responseHeaders,
    };

    // Handle CORS preflight
    if (config.cors !== false && config.cors) {
      const handled = handleCorsPreflight(request, response, config.cors);
      if (handled) {
        // Store headers and abort with empty response for preflight
        Object.assign((context as any)._securityHeaders || {}, responseHeaders);
        context.middleware.abort(undefined);
        return;
      }
    }

    // Validate CSRF token (before sanitization to catch early)
    if (config.csrf !== false && config.csrf) {
      const csrfResult = validateCsrfToken(request, response, config.csrf);
      if (!csrfResult.valid) {
        context.middleware.abort({
          error: csrfResult.error || "CSRF validation failed",
        });
        return;
      }

      // Set CSRF token cookie if not present (for GET requests)
      if (request.method === "GET") {
        const cookies = request.headers["cookie"] || request.headers["Cookie"];
        const cookieString = Array.isArray(cookies) ? cookies[0] : cookies || "";
        if (!cookieString.includes(config.csrf.cookieName || "_csrf")) {
          setCsrfTokenCookie(response, config.csrf);
        }
      }
    }

    // Apply security headers
    if (config.headers !== false) {
      applySecurityHeaders(response, config.headers);
    }

    // Apply CORS headers (for non-preflight requests)
    if (config.cors !== false && config.cors) {
      applyCorsHeaders(request, response, config.cors);
    }

    // Store headers in context for runtime to apply
    // The runtime will access reply._original to set headers
    if (!(context as any)._securityHeaders) {
      (context as any)._securityHeaders = {};
    }
    Object.assign((context as any)._securityHeaders, responseHeaders);

    // Sanitize request body and query parameters (modify context directly)
    if (config.sanitization !== false && config.sanitization) {
      const path = request.url || "/";
      
      if (context.body) {
        context.body = sanitizeRequestData(
          context.body,
          config.sanitization,
          path
        );
      }

      if (context.query) {
        context.query = sanitizeRequestData(
          context.query,
          config.sanitization,
          path
        );
      }
    }

    // Continue to next middleware
    await next();
  };
}

