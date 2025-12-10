/**
 * Central error handler for YAMA Node Runtime
 * 
 * This module provides standardized error handling for HTTP requests,
 * converting all errors to the standardized API error format.
 */

import type { HttpRequest, HttpResponse, HandlerContext } from "@betagors/yama-core";
import {
  YamaError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ErrorCodes,
  isYamaError,
  normalizeError,
  formatRestError,
  getRestErrorHeaders,
  getErrorLogLevel,
} from "@betagors/yama-errors";

/**
 * Options for handling errors
 */
export interface HandleErrorOptions {
  /** Whether to include suggestions in error response */
  includeSuggestions?: boolean;
  /** Whether to include stack trace (dev only) */
  includeStack?: boolean;
}

/**
 * Handle an error and send a standardized response.
 * 
 * This function:
 * 1. Normalizes the error to a YamaError
 * 2. Logs the error with appropriate level
 * 3. Sets response headers (including rate limit headers)
 * 4. Sends a standardized error response
 * 
 * @param error - The error that occurred (can be any type)
 * @param request - HTTP request object
 * @param reply - HTTP response object
 * @param context - Handler context (for logging and requestId)
 * @param options - Error handling options
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await handler(context);
 *   reply.send(result);
 * } catch (error) {
 *   handleError(error, request, reply, context);
 * }
 * ```
 */
export function handleError(
  error: unknown,
  request: HttpRequest,
  reply: HttpResponse,
  context: HandlerContext,
  options: HandleErrorOptions = {}
): void {
  const requestId = context.requestId;
  const {
    includeSuggestions = process.env.NODE_ENV !== 'production',
  } = options;

  // Normalize error to YamaError
  const yamaError = normalizeError(error);

  // Log the error with appropriate level
  const logLevel = getErrorLogLevel(yamaError);
  const logMeta = {
    requestId,
    code: yamaError.code,
    path: request.path,
    method: request.method,
    statusCode: yamaError.statusCode,
  };

  if (context.logger) {
    if (logLevel === 'error') {
      context.logger.error(yamaError.message, yamaError.cause || yamaError, logMeta);
    } else if (logLevel === 'warn') {
      context.logger.warn(yamaError.message, logMeta);
    } else {
      context.logger.info(yamaError.message, logMeta);
    }
  } else {
    // Fallback to console if no logger
    console.error(`[${yamaError.code}] ${yamaError.message}`, logMeta);
  }

  // Track error metrics
  context.metrics?.increment('http.errors', 1, {
    method: request.method,
    path: request.path,
    code: yamaError.code,
    status: String(yamaError.statusCode),
  });

  // Set response headers
  const headers = getRestErrorHeaders(yamaError, requestId);
  const originalReply = reply._original as any;
  if (originalReply && typeof originalReply.header === 'function') {
    for (const [key, value] of Object.entries(headers)) {
      originalReply.header(key, value);
    }
  }

  // Format and send error response
  const response = formatRestError(yamaError, {
    requestId,
    path: request.path,
    method: request.method,
    includeSuggestions,
  });

  reply.status(yamaError.statusCode).send(response);
}

/**
 * Create a validation error from validation results
 */
export function createValidationError(
  message: string,
  errors: Array<{ field?: string; message: string; rule?: string }>,
  type: 'body' | 'query' | 'params' = 'body'
): ValidationError {
  const codeMap = {
    body: ErrorCodes.VALIDATION_BODY,
    query: ErrorCodes.VALIDATION_QUERY,
    params: ErrorCodes.VALIDATION_PARAMS,
  };

  return new ValidationError(message, {
    code: codeMap[type],
    details: errors.map(e => ({
      field: e.field,
      message: e.message,
      rule: e.rule,
    })),
  });
}

/**
 * Create an authentication error
 */
export function createAuthError(
  message: string = 'Authentication required',
  code: string = ErrorCodes.AUTH_REQUIRED
): AuthenticationError {
  return new AuthenticationError(message, { code });
}

/**
 * Create an authorization error
 */
export function createAuthzError(
  message: string = 'Insufficient permissions',
  context?: { requiredRoles?: string[]; userRoles?: string[] }
): AuthorizationError {
  return new AuthorizationError(message, {
    code: ErrorCodes.AUTHZ_INSUFFICIENT_ROLE,
    context,
  });
}

/**
 * Create a not found error
 */
export function createNotFoundError(
  entityType: string,
  id?: string
): NotFoundError {
  const message = id 
    ? `${entityType} with id '${id}' not found`
    : `${entityType} not found`;
    
  return new NotFoundError(message, {
    code: ErrorCodes.NOT_FOUND_ENTITY,
    context: { entityType, id },
  });
}

/**
 * Create a rate limit error
 */
export function createRateLimitError(
  retryAfter: number,
  limit?: number,
  remaining?: number
): RateLimitError {
  return new RateLimitError(
    `Rate limit exceeded. Try again after ${retryAfter} seconds.`,
    {
      retryAfter,
      limit,
      remaining,
    }
  );
}

// Re-export error classes for convenience
export {
  YamaError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ErrorCodes,
  isYamaError,
  normalizeError,
  formatRestError,
} from "@betagors/yama-errors";
