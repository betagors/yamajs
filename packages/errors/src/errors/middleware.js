import { YamaError } from '../base.js';
/**
 * Error thrown when middleware execution fails.
 *
 * Default status code: 500 Internal Server Error
 *
 * @example
 * ```typescript
 * throw new MiddlewareError('Middleware execution failed', {
 *   code: ErrorCodes.MIDDLEWARE_ERROR,
 *   context: {
 *     middlewareName: 'authMiddleware',
 *     phase: 'pre-handler'
 *   },
 *   cause: originalError
 * });
 * ```
 */
export class MiddlewareError extends YamaError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'MIDDLEWARE_ERROR',
            statusCode: 500,
        });
    }
}
//# sourceMappingURL=middleware.js.map