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
export {
    PGLiteDatabaseProvider,
    PGLiteDatabaseAPI,
    createSQLTemplateTag,
} from './adapters/pglite.js';

// Register adapters (side effect)
import './adapters/pglite.js';
