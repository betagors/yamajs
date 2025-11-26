import type { DatabaseConfig, YamaEntities } from "../entities.js";

/**
 * Database connection result
 */
export interface DatabaseConnection {
  db: unknown; // Database client (dialect-specific)
  sql?: unknown; // Raw SQL client if available
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
 * Registry of database adapters by dialect
 */
const databaseAdapters = new Map<string, DatabaseAdapterFactory>();

/**
 * Register a database adapter for a specific dialect
 */
export function registerDatabaseAdapter(dialect: string, factory: DatabaseAdapterFactory): void {
  databaseAdapters.set(dialect.toLowerCase(), factory);
}

/**
 * Create a database adapter for the given dialect
 */
export function createDatabaseAdapter(dialect: string, config: DatabaseConfig): DatabaseAdapter {
  const normalizedDialect = dialect.toLowerCase();
  const factory = databaseAdapters.get(normalizedDialect);

  if (!factory) {
    throw new Error(
      `Unsupported database dialect: ${dialect}. Supported dialects: ${Array.from(databaseAdapters.keys()).join(", ")}`
    );
  }

  return factory(config);
}

