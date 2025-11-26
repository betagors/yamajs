import type { DatabaseAdapter } from "./database.js";

/**
 * Global database adapter registry
 * Used by auth providers and other components that need database access
 */
let globalDatabaseAdapter: DatabaseAdapter | null = null;

/**
 * Register the global database adapter
 * Should be called by the runtime after database initialization
 */
export function registerGlobalDatabaseAdapter(adapter: DatabaseAdapter): void {
  globalDatabaseAdapter = adapter;
}

/**
 * Get the global database adapter
 * Returns null if not registered
 */
export function getGlobalDatabaseAdapter(): DatabaseAdapter | null {
  return globalDatabaseAdapter;
}

