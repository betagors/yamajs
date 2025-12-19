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
} from './types.js';

export type { SQLTemplateTag } from './sql.js';

// Re-export IR and generators
export type * from './ir.js';
export { generateDatabaseIR } from './ir-generator.js';
export { generateDrizzleSchemaFromIR } from './drizzle-schema-generator.js';
