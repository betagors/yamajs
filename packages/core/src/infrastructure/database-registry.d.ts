import type { DatabaseAdapter } from "./database.js";
/**
 * Register the global database adapter
 * Should be called by the runtime after database initialization
 */
export declare function registerGlobalDatabaseAdapter(adapter: DatabaseAdapter): void;
/**
 * Get the global database adapter
 * Returns null if not registered
 */
export declare function getGlobalDatabaseAdapter(): DatabaseAdapter | null;
