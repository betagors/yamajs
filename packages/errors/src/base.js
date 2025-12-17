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
export class YamaError extends Error {
    constructor(message, options = {}) {
        super(message);
        // Set the prototype explicitly for proper instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = this.constructor.name;
        this.code = options.code || 'INTERNAL_ERROR';
        this.statusCode = options.statusCode || 500;
        this.context = options.context;
        this.suggestions = options.suggestions;
        this.cause = options.cause;
        this.details = options.details;
        this.timestamp = new Date().toISOString();
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * Convert error to a plain object for serialization
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            context: this.context,
            suggestions: this.suggestions,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }
    /**
     * Create a string representation of the error
     */
    toString() {
        let str = `${this.name} [${this.code}]: ${this.message}`;
        if (this.suggestions && this.suggestions.length > 0) {
            str += `\n\nSuggestions:\n${this.suggestions.map(s => `  - ${s}`).join('\n')}`;
        }
        return str;
    }
}
//# sourceMappingURL=base.js.map