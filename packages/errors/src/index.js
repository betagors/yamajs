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
// Base error class and types
export { YamaError, } from './base.js';
// Domain-specific error classes
export { ValidationError, AuthenticationError, AuthorizationError, NotFoundError, RateLimitError, DatabaseError, ConflictError, ConfigurationError, PluginError, ExternalServiceError, TimeoutError, MiddlewareError, } from './errors/index.js';
// Error codes
export { ErrorCodes, ErrorCodeToStatus, getStatusForCode, } from './codes.js';
// Formatters
export { 
// REST
formatRestError, getRestErrorHeaders, 
// GraphQL
formatGraphQLError, formatGraphQLErrors, 
// MCP
formatMCPError, createMCPTextResult, createMCPJsonResult, } from './formatters/index.js';
// Utilities
export { isYamaError, normalizeError, createError, wrapError, withSuggestions, getSafeErrorMessage, shouldLogError, getErrorLogLevel, } from './utils.js';
//# sourceMappingURL=index.js.map