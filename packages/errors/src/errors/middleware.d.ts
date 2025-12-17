import { YamaError, YamaErrorOptions } from '../base.js';
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
export declare class MiddlewareError extends YamaError {
    constructor(message: string, options?: Omit<YamaErrorOptions, 'statusCode'>);
}
//# sourceMappingURL=middleware.d.ts.map