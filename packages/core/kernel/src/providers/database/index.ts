/**
 * Database Provider
 * 
 * Provides SQL database functionality with swappable adapters.
 */

// Re-export types
export type {
    DatabaseProviderConfig,
    DatabaseAPI,
    ExecuteResult,
    TransactionAPI,
    SQLTemplateTag,
} from '../types.js';

// Re-export adapter utilities
// Adapters are now in separate packages (e.g. @yamajs/pglite)
