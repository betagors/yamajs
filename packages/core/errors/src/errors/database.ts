import { YamaError, YamaErrorOptions } from '../base.js';

/**
 * Error thrown when a database operation fails.
 * 
 * Default status code: 500 Internal Server Error
 * 
 * @example
 * ```typescript
 * throw new DatabaseError('Failed to insert record', {
 *   code: ErrorCodes.DB_CONSTRAINT_VIOLATION,
 *   context: { 
 *     table: 'users',
 *     constraint: 'users_email_unique' 
 *   },
 *   cause: originalDbError
 * });
 * ```
 */
export class DatabaseError extends YamaError {
  constructor(message: string, options: Omit<YamaErrorOptions, 'statusCode'> = {}) {
    super(message, {
      ...options,
      code: options.code || 'DB_ERROR',
      statusCode: 500,
    });
  }
}

/**
 * Error thrown when a database constraint is violated (unique, foreign key, etc.)
 * 
 * Default status code: 409 Conflict
 * 
 * @example
 * ```typescript
 * throw new ConflictError('Email already exists', {
 *   code: ErrorCodes.DB_UNIQUE_VIOLATION,
 *   context: { field: 'email', value: 'user@example.com' }
 * });
 * ```
 */
export class ConflictError extends YamaError {
  constructor(message: string, options: Omit<YamaErrorOptions, 'statusCode'> = {}) {
    super(message, {
      ...options,
      code: options.code || 'CONFLICT',
      statusCode: 409,
    });
  }
}
