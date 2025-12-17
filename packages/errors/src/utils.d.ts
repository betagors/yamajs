import { YamaError, YamaErrorOptions } from './base.js';
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
export declare function isYamaError(error: unknown): error is YamaError;
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
export declare function normalizeError(error: unknown, defaultOptions?: Partial<YamaErrorOptions>): YamaError;
/**
 * Create an error with the appropriate type based on error code.
 *
 * @param message - Error message
 * @param code - Error code (determines error type and status)
 * @param options - Additional options
 * @returns A YamaError instance with appropriate status code
 */
export declare function createError(message: string, code: string, options?: Omit<YamaErrorOptions, 'code' | 'statusCode'>): YamaError;
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
export declare function wrapError(error: unknown, context: Record<string, unknown>): YamaError;
/**
 * Add suggestions to an error.
 *
 * @param error - The error to add suggestions to
 * @param suggestions - Suggestions to add
 * @returns A YamaError with suggestions
 */
export declare function withSuggestions(error: unknown, suggestions: string[]): YamaError;
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
export declare function getSafeErrorMessage(error: YamaError, isProduction?: boolean): string;
/**
 * Check if an error should be logged (not all errors need logging)
 */
export declare function shouldLogError(error: YamaError): boolean;
/**
 * Get log level for an error
 */
export declare function getErrorLogLevel(error: YamaError): 'error' | 'warn' | 'info';
//# sourceMappingURL=utils.d.ts.map