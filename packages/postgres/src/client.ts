import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { DatabaseConfig } from "@yama/core";

type DrizzlePostgres = ReturnType<typeof drizzlePostgres>;

let dbClient: DrizzlePostgres | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

/**
 * Initialize database connection
 */
export async function initDatabase(config: DatabaseConfig): Promise<{
  db: DrizzlePostgres;
  sql: ReturnType<typeof postgres>;
}> {
  if (dbClient && sqlClient) {
    return { db: dbClient, sql: sqlClient };
  }

  if (!config.url) {
    throw new Error("PostgreSQL database URL is required");
  }

  // Use regular PostgreSQL client
  sqlClient = postgres(config.url, {
    max: config.pool?.max || 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Create drizzle instance
  dbClient = drizzlePostgres(sqlClient) as DrizzlePostgres;

  return { db: dbClient, sql: sqlClient };
}

/**
 * Get database client (must be initialized first)
 */
export function getDatabase(): DrizzlePostgres {
  if (!dbClient) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbClient;
}

/**
 * Get SQL client (must be initialized first)
 */
export function getSQL(): ReturnType<typeof postgres> {
  if (!sqlClient) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return sqlClient;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    dbClient = null;
  }
}


