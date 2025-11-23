// Export client functions (legacy - for backward compatibility)
export {
  initDatabase,
  getDatabase,
  getSQL,
  closeDatabase,
} from "./client.ts";

// Export generators
export { generateDrizzleSchema } from "./drizzle-schema.ts";
export {
  generateMigrationSQL,
  generateMigrationFile,
  generateSQLFromSteps,
  computeMigrationChecksum,
  getMigrationTableSQL,
  getMigrationRunsTableSQL,
} from "./migrations.ts";
export { generateMapper } from "./mapper.ts";
export { generateRepository } from "./repository.ts";

// Export adapter
export { postgresqlAdapter } from "./adapter.ts";

// Export snapshot functions
export {
  createDataSnapshot,
  restoreFromSnapshot,
  deleteSnapshot,
  listSnapshots,
} from "./snapshots.ts";

// Export plugin (default export)
export { default as plugin } from "./plugin.ts";
export { default } from "./plugin.ts";

