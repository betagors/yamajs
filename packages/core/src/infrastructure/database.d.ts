import type { DatabaseConfig, YamaEntities } from "../entities.js";
/**
 * Database connection result
 */
export interface DatabaseConnection {
    db: unknown;
    sql?: unknown;
}
/**
 * Database adapter interface - unified API for all database dialects
 */
export interface DatabaseAdapter {
    /**
     * Initialize database connection
     */
    init(config: DatabaseConfig): Promise<DatabaseConnection>;
    /**
     * Get database client (must be initialized first)
     */
    getClient(): unknown;
    /**
     * Get raw SQL client if available (must be initialized first)
     */
    getSQL?(): unknown;
    /**
     * Close database connection
     */
    close(): Promise<void>;
    /**
     * Generate database schema from entities (for codegen)
     */
    generateSchema?(entities: YamaEntities): Promise<string>;
    /**
     * Generate migration SQL from entities
     */
    generateMigration?(entities: YamaEntities, migrationName: string): Promise<string>;
}
/**
 * Database adapter factory function type
 */
export type DatabaseAdapterFactory = (config: DatabaseConfig) => DatabaseAdapter;
/**
 * Register a database adapter for a specific dialect
 */
export declare function registerDatabaseAdapter(dialect: string, factory: DatabaseAdapterFactory): void;
/**
 * Create a database adapter for the given dialect
 */
export declare function createDatabaseAdapter(dialect: string, config: DatabaseConfig): DatabaseAdapter;
