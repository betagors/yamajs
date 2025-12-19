export { default as plugin } from "./plugin.js";

// Export types
export type {
  CorsConfig,
  CsrfConfig,
  SecurityHeadersConfig,
  SanitizationConfig,
  SecurityPluginConfig,
} from "./types.js";

// Export CORS functions
export {
  handleCorsPreflight,
  applyCorsHeaders,
} from "./cors.js";

// Export CSRF functions
export {
  generateCsrfToken,
  verifyCsrfToken,
  validateCsrfToken,
  setCsrfTokenCookie,
} from "./csrf.js";

// Export security headers functions
export {
  applySecurityHeaders,
} from "./headers.js";

// Export sanitization functions
export {
  sanitizeRequestData,
} from "./sanitization.js";

// Export middleware creation
export {
  createSecurityMiddleware,
} from "./middleware.js";



















