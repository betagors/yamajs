/**
 * Global database adapter registry
 * Used by auth providers and other components that need database access
 */
let globalDatabaseAdapter = null;
/**
 * Register the global database adapter
 * Should be called by the runtime after database initialization
 */
export function registerGlobalDatabaseAdapter(adapter) {
    globalDatabaseAdapter = adapter;
}
/**
 * Get the global database adapter
 * Returns null if not registered
 */
export function getGlobalDatabaseAdapter() {
    return globalDatabaseAdapter;
}
//# sourceMappingURL=database-registry.js.map