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
export {
  YamaError,
  type YamaErrorOptions,
  type ValidationErrorDetail,
} from '../../../../../../../../../../core/errors/src/base';

// Domain-specific error classes
export {
  ValidationError,
  type ValidationErrorOptions,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  type RateLimitErrorOptions,
  DatabaseError,
  ConflictError,
  ConfigurationError,
  PluginError,
  ExternalServiceError,
  TimeoutError,
  MiddlewareError,
} from '../../../../../../../../../../core/errors/src/errors';

// Error codes
export {
  ErrorCodes,
  ErrorCodeToStatus,
  getStatusForCode,
  type ErrorCode,
} from '../../../../../../../../../../core/errors/src/codes';

// Formatters
export {
  // REST
  formatRestError,
  getRestErrorHeaders,
  type RestErrorResponse,
  type FormatRestErrorOptions,
  // GraphQL
  formatGraphQLError,
  formatGraphQLErrors,
  type GraphQLFormattedError,
  type GraphQLErrorLocation,
  type GraphQLErrorExtensions,
  type FormatGraphQLErrorOptions,
  // MCP
  formatMCPError,
  createMCPTextResult,
  createMCPJsonResult,
  type MCPToolResult,
  type MCPToolResultContent,
  type FormatMCPErrorOptions,
} from '../../../../../../../../../../core/errors/src/formatters';

// Utilities
export {
  isYamaError,
  normalizeError,
  createError,
  wrapError,
  withSuggestions,
  getSafeErrorMessage,
  shouldLogError,
  getErrorLogLevel,
} from '../../../../../../../../../../core/errors/src/utils';
