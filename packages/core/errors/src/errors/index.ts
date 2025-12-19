// Re-export all error classes
export { ValidationError, type ValidationErrorOptions } from '../../../../../../../../../../../core/errors/src/errors/validation';
export { AuthenticationError, AuthorizationError } from '../../../../../../../../../../../core/errors/src/errors/auth';
export { NotFoundError } from '../../../../../../../../../../../core/errors/src/errors/not-found';
export { RateLimitError, type RateLimitErrorOptions } from '../../../../../../../../../../../core/errors/src/errors/rate-limit';
export { DatabaseError, ConflictError } from '../../../../../../../../../../../core/errors/src/errors/database';
export { ConfigurationError } from '../../../../../../../../../../../core/errors/src/errors/config';
export { PluginError } from '../../../../../../../../../../../core/errors/src/errors/plugin';
export { ExternalServiceError, TimeoutError } from '../../../../../../../../../../../core/errors/src/errors/external';
export { MiddlewareError } from '../../../../../../../../../../../core/errors/src/errors/middleware';
