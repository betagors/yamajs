import { RateLimitError } from '../errors/rate-limit.js';
/**
 * Format a YamaError for REST API response.
 *
 * Creates a standardized error response format that includes:
 * - Error code and message
 * - Request ID for tracing
 * - Timestamp
 * - Validation details (if applicable)
 * - Rate limit info (if applicable)
 *
 * @param error - The YamaError to format
 * @param options - Formatting options
 * @returns Standardized REST error response
 *
 * @example
 * ```typescript
 * const response = formatRestError(error, { requestId: 'abc-123', path: '/api/users' });
 * // {
 * //   error: {
 * //     code: 'VALIDATION_BODY',
 * //     message: 'Invalid request body',
 * //     requestId: 'abc-123',
 * //     timestamp: '2024-01-01T00:00:00.000Z',
 * //     path: '/api/users',
 * //     details: [...]
 * //   }
 * // }
 * ```
 */
export function formatRestError(error, options = {}) {
    const { requestId, path, method, includeSuggestions = process.env.NODE_ENV !== 'production', } = options;
    const response = {
        error: {
            code: error.code,
            message: error.message,
            timestamp: error.timestamp,
        },
    };
    // Add request context
    if (requestId) {
        response.error.requestId = requestId;
    }
    if (path) {
        response.error.path = path;
    }
    if (method) {
        response.error.method = method;
    }
    // Add validation details
    if (error.details && error.details.length > 0) {
        response.error.details = error.details;
    }
    // Add suggestions (typically only in development)
    if (includeSuggestions && error.suggestions && error.suggestions.length > 0) {
        response.error.suggestions = error.suggestions;
    }
    // Add rate limit info
    if (error instanceof RateLimitError && error.retryAfter !== undefined) {
        response.error.retryAfter = error.retryAfter;
    }
    return response;
}
/**
 * Get HTTP headers for a REST error response
 */
export function getRestErrorHeaders(error, requestId) {
    const headers = {};
    // Always include request ID if available
    if (requestId) {
        headers['X-Request-ID'] = requestId;
    }
    // Rate limit headers
    if (error instanceof RateLimitError) {
        if (error.retryAfter !== undefined) {
            headers['Retry-After'] = String(error.retryAfter);
        }
        if (error.limit !== undefined) {
            headers['X-RateLimit-Limit'] = String(error.limit);
        }
        if (error.remaining !== undefined) {
            headers['X-RateLimit-Remaining'] = String(error.remaining);
        }
        if (error.resetAt) {
            headers['X-RateLimit-Reset'] = error.resetAt;
        }
    }
    return headers;
}
//# sourceMappingURL=rest.js.map