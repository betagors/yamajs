import { YamaError } from '../base.js';
/**
 * Error thrown when an external service call fails.
 *
 * Default status code: 502 Bad Gateway
 *
 * @example
 * ```typescript
 * throw new ExternalServiceError('Payment provider unavailable', {
 *   code: ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE,
 *   context: {
 *     service: 'stripe',
 *     endpoint: '/v1/charges',
 *     responseStatus: 503
 *   },
 *   cause: originalError
 * });
 * ```
 */
export class ExternalServiceError extends YamaError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'EXTERNAL_SERVICE_ERROR',
            statusCode: 502,
        });
    }
}
/**
 * Error thrown when an external service times out.
 *
 * Default status code: 504 Gateway Timeout
 *
 * @example
 * ```typescript
 * throw new TimeoutError('Database query timed out', {
 *   context: {
 *     operation: 'findAll',
 *     timeoutMs: 30000
 *   }
 * });
 * ```
 */
export class TimeoutError extends YamaError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'TIMEOUT',
            statusCode: 504,
        });
    }
}
//# sourceMappingURL=external.js.map