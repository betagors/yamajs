// Re-export all error classes
export { ValidationError, type ValidationErrorOptions } from './validation.js';
export { AuthenticationError, AuthorizationError } from './auth.js';
export { NotFoundError } from './not-found.js';
export { RateLimitError, type RateLimitErrorOptions } from './rate-limit.js';
export { DatabaseError, ConflictError } from './database.js';
export { ConfigurationError } from './config.js';
export { PluginError } from './plugin.js';
export { ExternalServiceError, TimeoutError } from './external.js';
export { MiddlewareError } from './middleware.js';
