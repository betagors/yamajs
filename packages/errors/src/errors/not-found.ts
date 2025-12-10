import { YamaError, YamaErrorOptions } from '../base.js';

/**
 * Error thrown when a requested resource is not found.
 * 
 * Default status code: 404 Not Found
 * 
 * @example
 * ```typescript
 * throw new NotFoundError('User not found', {
 *   code: ErrorCodes.NOT_FOUND_ENTITY,
 *   context: { entityType: 'User', id: '123' }
 * });
 * ```
 */
export class NotFoundError extends YamaError {
  constructor(message: string, options: Omit<YamaErrorOptions, 'statusCode'> = {}) {
    super(message, {
      ...options,
      code: options.code || 'NOT_FOUND',
      statusCode: 404,
    });
  }
}
