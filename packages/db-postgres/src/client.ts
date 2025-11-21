import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { DatabaseConfig } from "@yama/core";

let dbClient: ReturnType<typeof drizzle> | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

/**
 * Initialize database connection
 */
export function initDatabase(config: DatabaseConfig): {
  db: ReturnType<typeof drizzle>;
  sql: ReturnType<typeof postgres>;
} {
  if (dbClient && sqlClient) {
    return { db: dbClient, sql: sqlClient };
  }

  // Create postgres client
  sqlClient = postgres(config.url, {
    max: config.pool?.max || 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Create drizzle instance
  dbClient = drizzle(sqlClient);

  return { db: dbClient, sql: sqlClient };
}

/**
 * Get database client (must be initialized first)
 */
export function getDatabase(): ReturnType<typeof drizzle> {
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


