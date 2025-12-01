/**
 * Registry of database adapters by dialect
 */
const databaseAdapters = new Map();
/**
 * Register a database adapter for a specific dialect
 */
export function registerDatabaseAdapter(dialect, factory) {
    databaseAdapters.set(dialect.toLowerCase(), factory);
}
/**
 * Create a database adapter for the given dialect
 */
export function createDatabaseAdapter(dialect, config) {
    const normalizedDialect = dialect.toLowerCase();
    const factory = databaseAdapters.get(normalizedDialect);
    if (!factory) {
        throw new Error(`Unsupported database dialect: ${dialect}. Supported dialects: ${Array.from(databaseAdapters.keys()).join(", ")}`);
    }
    return factory(config);
}
//# sourceMappingURL=database.js.map