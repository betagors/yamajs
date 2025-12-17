/**
 * @yamajs/errors
 *
 * Standardized error handling for YAMA applications.
 *
 * @example
 * ```typescript
 * import {
 *   ValidationError,
 *   AuthenticationError,
 *   ErrorCodes,
 *   formatRestError,
 *   isYamaError
 * } from '@yamajs/errors';
 *
 * // Throw a validation error
 * throw new ValidationError('Invalid email', {
 *   code: ErrorCodes.VALIDATION_FORMAT,
 *   details: [{ field: 'email', message: 'Invalid format' }]
 * });
 *
 * // Format for API response
 * const response = formatRestError(error, { requestId: 'abc-123' });
 * ```
 */
export { YamaError, type YamaErrorOptions, type ValidationErrorDetail, } from './base.js';
export { ValidationError, type ValidationErrorOptions, AuthenticationError, AuthorizationError, NotFoundError, RateLimitError, type RateLimitErrorOptions, DatabaseError, ConflictError, ConfigurationError, PluginError, ExternalServiceError, TimeoutError, MiddlewareError, } from './errors/index.js';
export { ErrorCodes, ErrorCodeToStatus, getStatusForCode, type ErrorCode, } from './codes.js';
export { formatRestError, getRestErrorHeaders, type RestErrorResponse, type FormatRestErrorOptions, formatGraphQLError, formatGraphQLErrors, type GraphQLFormattedError, type GraphQLErrorLocation, type GraphQLErrorExtensions, type FormatGraphQLErrorOptions, formatMCPError, createMCPTextResult, createMCPJsonResult, type MCPToolResult, type MCPToolResultContent, type FormatMCPErrorOptions, } from './formatters/index.js';
export { isYamaError, normalizeError, createError, wrapError, withSuggestions, getSafeErrorMessage, shouldLogError, getErrorLogLevel, } from './utils.js';
//# sourceMappingURL=index.d.ts.map