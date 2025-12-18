import { YamaError, YamaErrorOptions } from '../base.js';
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
export declare class ExternalServiceError extends YamaError {
    constructor(message: string, options?: Omit<YamaErrorOptions, 'statusCode'>);
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
export declare class TimeoutError extends YamaError {
    constructor(message: string, options?: Omit<YamaErrorOptions, 'statusCode'>);
}
