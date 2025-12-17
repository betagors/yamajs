import { YamaError } from '../base.js';
/**
 * Error thrown when input validation fails.
 *
 * Default status code: 400 Bad Request
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid request body', {
 *   code: ErrorCodes.VALIDATION_BODY,
 *   details: [
 *     { field: 'email', message: 'Invalid email format', rule: 'format' },
 *     { field: 'age', message: 'Must be at least 18', rule: 'minimum' }
 *   ]
 * });
 * ```
 */
export class ValidationError extends YamaError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'VALIDATION_FAILED',
            statusCode: 400,
        });
    }
}
//# sourceMappingURL=validation.js.map