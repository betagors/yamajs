// Export client functions (legacy - for backward compatibility)
export {
  initDatabase,
  getDatabase,
  getSQL,
  closeDatabase,
} from "./client.js";

// Export generators
export { generateDrizzleSchema } from "./drizzle-schema.js";
export {
  generateMigrationSQL,
  generateMigrationFile,
  generateSQLFromSteps,
  computeMigrationChecksum,
  getMigrationTableSQL,
  getMigrationRunsTableSQL,
} from "./migrations.js";
export { generateMapper } from "./mapper.js";
export { generateRepository } from "./repository.js";

// Export adapter
export { postgresqlAdapter } from "./adapter.js";

// Export snapshot functions
export {
  createDataSnapshot,
  restoreFromSnapshot,
  deleteSnapshot,
  listSnapshots,
} from "./snapshots.js";

// Export plugin (default export)
export { default as plugin } from "./plugin.js";
export { default } from "./plugin.js";

