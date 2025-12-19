/**
 * Logging Provider
 * 
 * Logging is now a Core Service, not a Provider.
 * The core Logger interface is provided by @yamajs/logging.
 * 
 * For type compatibility, we re-export the Logger types here.
 */

// Re-export core logging types from @yamajs/logging
export { Logger, LogLevel } from "packages/core/logging";
export type { Transport as LogTransport, LoggerConfig } from "packages/core/logging";

