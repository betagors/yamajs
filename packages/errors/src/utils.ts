import { YamaError, YamaErrorOptions } from './base.js';
import { ErrorCodes, getStatusForCode } from './codes.js';

/**
 * Type guard to check if an error is a YamaError
 * 
 * @param error - The error to check
 * @returns True if the error is a YamaError instance
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isYamaError(error)) {
 *     console.log(error.code); // TypeScript knows this is a YamaError
 *   }
 * }
 * ```
 */
export function isYamaError(error: unknown): error is YamaError {
  return error instanceof YamaError;
}

/**
 * Normalize any error into a YamaError.
 * 
 * This function handles:
 * - YamaError instances (returned as-is)
 * - Standard Error instances (wrapped with INTERNAL_ERROR code)
 * - Non-error values (converted to string message)
 * 
 * @param error - Any value that was thrown
 * @param defaultOptions - Default options to apply if creating a new YamaError
 * @returns A YamaError instance
 * 
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const yamaError = normalizeError(error);
 *   // yamaError is guaranteed to be a YamaError
 * }
 * ```
 */
export function normalizeError(
  error: unknown,
  defaultOptions: Partial<YamaErrorOptions> = {}
): YamaError {
  // Already a YamaError
  if (isYamaError(error)) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    return new YamaError(error.message, {
      code: defaultOptions.code || ErrorCodes.INTERNAL_ERROR,
      statusCode: defaultOptions.statusCode || 500,
      cause: error,
      context: defaultOptions.context,
      suggestions: defaultOptions.suggestions,
    });
  }

  // Non-error value (string, object, etc.)
  const message = typeof error === 'string' 
    ? error 
    : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error);

  return new YamaError(message, {
    code: defaultOptions.code || ErrorCodes.INTERNAL_ERROR,
    statusCode: defaultOptions.statusCode || 500,
    context: defaultOptions.context,
    suggestions: defaultOptions.suggestions,
  });
}

/**
 * Create an error with the appropriate type based on error code.
 * 
 * @param message - Error message
 * @param code - Error code (determines error type and status)
 * @param options - Additional options
 * @returns A YamaError instance with appropriate status code
 */
export function createError(
  message: string,
  code: string,
  options: Omit<YamaErrorOptions, 'code' | 'statusCode'> = {}
): YamaError {
  return new YamaError(message, {
    ...options,
    code,
    statusCode: getStatusForCode(code),
  });
}

/**
 * Wrap an error with additional context.
 * 
 * Useful for adding context as errors propagate up the stack.
 * 
 * @param error - The error to wrap
 * @param context - Additional context to add
 * @returns A YamaError with combined context
 * 
 * @example
 * ```typescript
 * try {
 *   await repository.create(data);
 * } catch (error) {
 *   throw wrapError(error, { operation: 'create', entity: 'User' });
 * }
 * ```
 */
export function wrapError(
  error: unknown,
  context: Record<string, unknown>
): YamaError {
  const yamaError = normalizeError(error);
  
  return new YamaError(yamaError.message, {
    code: yamaError.code,
    statusCode: yamaError.statusCode,
    context: { ...yamaError.context, ...context },
    suggestions: yamaError.suggestions,
    details: yamaError.details,
    cause: yamaError.cause || (error instanceof Error ? error : undefined),
  });
}

/**
 * Add suggestions to an error.
 * 
 * @param error - The error to add suggestions to
 * @param suggestions - Suggestions to add
 * @returns A YamaError with suggestions
 */
export function withSuggestions(
  error: unknown,
  suggestions: string[]
): YamaError {
  const yamaError = normalizeError(error);
  
  return new YamaError(yamaError.message, {
    code: yamaError.code,
    statusCode: yamaError.statusCode,
    context: yamaError.context,
    suggestions: [...(yamaError.suggestions || []), ...suggestions],
    details: yamaError.details,
    cause: yamaError.cause,
  });
}

/**
 * Extract a safe error message for external consumption.
 * 
 * In production, this returns a generic message for 500 errors
 * to avoid leaking internal details.
 * 
 * @param error - The error to extract message from
 * @param isProduction - Whether running in production mode
 * @returns Safe error message
 */
export function getSafeErrorMessage(
  error: YamaError,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): string {
  // In production, don't expose internal error details
  if (isProduction && error.statusCode >= 500) {
    return 'An internal error occurred';
  }
  
  return error.message;
}

/**
 * Check if an error should be logged (not all errors need logging)
 */
export function shouldLogError(error: YamaError): boolean {
  // Always log 5xx errors
  if (error.statusCode >= 500) {
    return true;
  }
  
  // Log auth failures (potential security issues)
  if (error.code.startsWith('AUTH_') || error.code.startsWith('AUTHZ_')) {
    return true;
  }
  
  // Don't log expected client errors
  return false;
}

/**
 * Get log level for an error
 */
export function getErrorLogLevel(error: YamaError): 'error' | 'warn' | 'info' {
  if (error.statusCode >= 500) {
    return 'error';
  }
  
  if (error.statusCode >= 400) {
    return 'warn';
  }
  
  return 'info';
}
