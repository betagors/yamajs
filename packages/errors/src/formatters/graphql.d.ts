import { YamaError } from '../base.js';
/**
 * GraphQL error location
 */
export interface GraphQLErrorLocation {
    line: number;
    column: number;
}
/**
 * GraphQL error extensions
 */
export interface GraphQLErrorExtensions {
    /** Error code */
    code: string;
    /** HTTP status code equivalent */
    statusCode: number;
    /** ISO timestamp */
    timestamp: string;
    /** Request ID for tracing */
    requestId?: string;
    /** Additional context */
    context?: Record<string, unknown>;
    /** Validation details */
    details?: unknown[];
    /** Suggestions for fixing the error */
    suggestions?: string[];
}
/**
 * GraphQL error format (follows GraphQL spec)
 */
export interface GraphQLFormattedError {
    /** Error message */
    message: string;
    /** Path to the field that caused the error */
    path?: (string | number)[];
    /** Location in the query */
    locations?: GraphQLErrorLocation[];
    /** Extensions for additional metadata */
    extensions: GraphQLErrorExtensions;
}
/**
 * Options for formatting GraphQL errors
 */
export interface FormatGraphQLErrorOptions {
    /** Path to the field that caused the error */
    path?: (string | number)[];
    /** Location in the query */
    locations?: GraphQLErrorLocation[];
    /** Request ID for correlation */
    requestId?: string;
    /** Whether to include suggestions */
    includeSuggestions?: boolean;
}
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
export declare function formatGraphQLError(error: YamaError, options?: FormatGraphQLErrorOptions): GraphQLFormattedError;
/**
 * Format multiple errors for GraphQL response
 */
export declare function formatGraphQLErrors(errors: YamaError[], options?: Omit<FormatGraphQLErrorOptions, 'path' | 'locations'>): {
    errors: GraphQLFormattedError[];
};
//# sourceMappingURL=graphql.d.ts.map