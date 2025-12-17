/**
 * Options for creating a YamaError
 */
export interface YamaErrorOptions {
    /** Error code (e.g., 'VALIDATION_BODY', 'AUTH_REQUIRED') */
    code?: string;
    /** HTTP status code (defaults based on error type) */
    statusCode?: number;
    /** Additional context about the error */
    context?: Record<string, unknown>;
    /** Suggestions for fixing the error */
    suggestions?: string[];
    /** Original error that caused this error */
    cause?: Error;
    /** Validation error details */
    details?: ValidationErrorDetail[];
}
/**
 * Detail for a single validation error
 */
export interface ValidationErrorDetail {
    /** Field path (e.g., 'email', 'address.city') */
    field?: string;
    /** Error message for this field */
    message: string;
    /** Validation rule that failed (e.g., 'required', 'format') */
    rule?: string;
    /** Expected value or format */
    expected?: unknown;
    /** Actual value received */
    actual?: unknown;
}
/**
 * Base error class for all YAMA errors.
 *
 * Extends the standard Error class with additional properties:
 * - code: Machine-readable error code
 * - statusCode: HTTP status code
 * - context: Additional contextual information
 * - suggestions: Developer-friendly suggestions for fixing the error
 * - cause: Original error that caused this error
 * - details: Validation error details (for ValidationError)
 *
 * @example
 * ```typescript
 * throw new YamaError('Something went wrong', {
 *   code: 'INTERNAL_ERROR',
 *   statusCode: 500,
 *   context: { operation: 'database_query' },
 *   suggestions: ['Check database connection', 'Verify query syntax']
 * });
 * ```
 */
export declare class YamaError extends Error {
    /** Machine-readable error code */
    readonly code: string;
    /** HTTP status code */
    readonly statusCode: number;
    /** Additional context about the error */
    readonly context?: Record<string, unknown>;
    /** Suggestions for fixing the error */
    readonly suggestions?: string[];
    /** Original error that caused this error */
    readonly cause?: Error;
    /** Validation error details */
    readonly details?: ValidationErrorDetail[];
    /** Timestamp when the error was created */
    readonly timestamp: string;
    constructor(message: string, options?: YamaErrorOptions);
    /**
     * Convert error to a plain object for serialization
     */
    toJSON(): Record<string, unknown>;
    /**
     * Create a string representation of the error
     */
    toString(): string;
}
//# sourceMappingURL=base.d.ts.map