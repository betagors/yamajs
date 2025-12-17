/**
 * Format a YamaError for GraphQL response.
 *
 * Creates a GraphQL-compliant error format with extensions for
 * additional metadata like error codes and timestamps.
 *
 * @param error - The YamaError to format
 * @param options - Formatting options
 * @returns GraphQL-formatted error
 *
 * @example
 * ```typescript
 * const graphqlError = formatGraphQLError(error, {
 *   path: ['createUser', 'email'],
 *   requestId: 'abc-123'
 * });
 * // {
 * //   message: 'Invalid email format',
 * //   path: ['createUser', 'email'],
 * //   extensions: {
 * //     code: 'VALIDATION_FORMAT',
 * //     statusCode: 400,
 * //     timestamp: '...'
 * //   }
 * // }
 * ```
 */
export function formatGraphQLError(error, options = {}) {
    const { path, locations, requestId, includeSuggestions = process.env.NODE_ENV !== 'production', } = options;
    const formattedError = {
        message: error.message,
        extensions: {
            code: error.code,
            statusCode: error.statusCode,
            timestamp: error.timestamp,
        },
    };
    // Add path and locations if provided
    if (path && path.length > 0) {
        formattedError.path = path;
    }
    if (locations && locations.length > 0) {
        formattedError.locations = locations;
    }
    // Add request ID
    if (requestId) {
        formattedError.extensions.requestId = requestId;
    }
    // Add context if available
    if (error.context) {
        formattedError.extensions.context = error.context;
    }
    // Add validation details
    if (error.details && error.details.length > 0) {
        formattedError.extensions.details = error.details;
    }
    // Add suggestions
    if (includeSuggestions && error.suggestions && error.suggestions.length > 0) {
        formattedError.extensions.suggestions = error.suggestions;
    }
    return formattedError;
}
/**
 * Format multiple errors for GraphQL response
 */
export function formatGraphQLErrors(errors, options = {}) {
    return {
        errors: errors.map(error => formatGraphQLError(error, options)),
    };
}
//# sourceMappingURL=graphql.js.map