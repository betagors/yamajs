import { YamaError, YamaErrorOptions } from '../base.js';

/**
 * Error thrown when authentication fails.
 * 
 * Default status code: 401 Unauthorized
 * 
 * @example
 * ```typescript
 * throw new AuthenticationError('Invalid or expired token', {
 *   code: ErrorCodes.AUTH_INVALID_TOKEN,
 *   suggestions: [
 *     'Check that your token has not expired',
 *     'Ensure you are using the Bearer authentication scheme'
 *   ]
 * });
 * ```
 */
export class AuthenticationError extends YamaError {
  constructor(message: string, options: Omit<YamaErrorOptions, 'statusCode'> = {}) {
    super(message, {
      ...options,
      code: options.code || 'AUTH_REQUIRED',
      statusCode: 401,
    });
  }
}

/**
 * Error thrown when authorization fails (user is authenticated but lacks permission).
 * 
 * Default status code: 403 Forbidden
 * 
 * @example
 * ```typescript
 * throw new AuthorizationError('Insufficient permissions to access this resource', {
 *   code: ErrorCodes.AUTHZ_INSUFFICIENT_ROLE,
 *   context: { 
 *     requiredRoles: ['admin'], 
 *     userRoles: ['user'] 
 *   }
 * });
 * ```
 */
export class AuthorizationError extends YamaError {
  constructor(message: string, options: Omit<YamaErrorOptions, 'statusCode'> = {}) {
    super(message, {
      ...options,
      code: options.code || 'AUTHZ_FORBIDDEN',
      statusCode: 403,
    });
  }
}
