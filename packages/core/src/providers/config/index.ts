/**
 * Config Provider
 * 
 * Provides access to configuration values from environment variables and .env files.
 */

// Re-export types
export type { ConfigProviderConfig, ConfigAPI } from '../types.js';

// Re-export adapter utilities
export {
    substituteVariables,
    hasUnresolvedVariables,
    parseEnvContent,
    loadEnvFile,
} from './adapters/env.js';

// Register adapters (side effect)
import './adapters/env.js';
