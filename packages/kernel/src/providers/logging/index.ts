/**
 * Logging Provider
 * 
 * Provides structured logging with multiple format options.
 */

// Re-export types
export type { LoggingProviderConfig, LoggerAPI, LogLevel } from '../types.js';

// Re-export adapter utilities
export {
    ConsoleLoggingProvider,
    ConsoleLogger,
    formatPretty,
    formatJSON,
} from './adapters/console.js';

// Register adapters (side effect)
import './adapters/console.js';
