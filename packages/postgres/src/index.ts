// Export client functions (legacy - for backward compatibility)
export {
  initDatabase,
  getDatabase,
  getSQL,
  closeDatabase,
} from "./client";

// Export generators
export { generateDrizzleSchema } from "./drizzle-schema";
export {
  generateMigrationSQL,
  generateMigrationFile,
  generateSQLFromSteps,
  computeMigrationChecksum,
  getMigrationTableSQL,
  getMigrationRunsTableSQL,
} from "./migrations";
export { generateMapper } from "./mapper";
export { generateRepository } from "./repository";

// Export adapter
export { postgresqlAdapter } from "./adapter";

// Export snapshot functions
export {
  createDataSnapshot,
  restoreFromSnapshot,
  deleteSnapshot,
  listSnapshots,
} from "./snapshots";

// Export plugin (default export)
export { default as plugin } from "./plugin";
export { default } from "./plugin";

