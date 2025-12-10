import { YamaError, YamaErrorOptions, ValidationErrorDetail } from '../base.js';

/**
 * Options specific to validation errors
 */
export interface ValidationErrorOptions extends Omit<YamaErrorOptions, 'statusCode'> {
  /** Validation error details */
  details?: ValidationErrorDetail[];
}

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
  constructor(message: string, options: ValidationErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code || 'VALIDATION_FAILED',
      statusCode: 400,
    });
  }
}
