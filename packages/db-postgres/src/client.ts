import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { DatabaseConfig } from "@yama/core";

type PGliteClient = Awaited<ReturnType<typeof import("@electric-sql/pglite").PGlite>>;
type DrizzlePGlite = ReturnType<typeof import("drizzle-orm/pglite").drizzle>;
type DrizzlePostgres = ReturnType<typeof drizzlePostgres>;

let dbClient: DrizzlePostgres | DrizzlePGlite | null = null;
let sqlClient: ReturnType<typeof postgres> | PGliteClient | null = null;
let isPGlite = false;

/**
 * Check if URL indicates in-memory PGlite mode
 */
function isInMemoryMode(url: string | undefined): boolean {
  return url === ":memory:" || url === "pglite";
}

/**
 * Initialize database connection
 */
export async function initDatabase(config: DatabaseConfig): Promise<{
  db: DrizzlePostgres | DrizzlePGlite;
  sql: ReturnType<typeof postgres> | PGliteClient;
}> {
  if (dbClient && sqlClient) {
    return { db: dbClient, sql: sqlClient };
  }

  if (!config.url) {
    throw new Error("PostgreSQL database URL is required");
  }

  // Check if using in-memory PGlite mode
  if (isInMemoryMode(config.url)) {
    try {
      // Dynamically import PGlite (optional dependency)
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle: drizzlePGlite } = await import("drizzle-orm/pglite");

      // Create PGlite client (in-memory by default)
      const pgliteClient = new PGlite();
      await pgliteClient.waitReady;
      
      sqlClient = pgliteClient as unknown as PGliteClient;
      dbClient = drizzlePGlite(pgliteClient) as DrizzlePGlite;
      isPGlite = true;

      return { db: dbClient, sql: sqlClient };
    } catch (error) {
      throw new Error(
        `Failed to initialize PGlite. Make sure @electric-sql/pglite is installed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Use regular PostgreSQL client
  sqlClient = postgres(config.url, {
    max: config.pool?.max || 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Create drizzle instance
  dbClient = drizzlePostgres(sqlClient) as DrizzlePostgres;
  isPGlite = false;

  return { db: dbClient, sql: sqlClient };
}

/**
 * Get database client (must be initialized first)
 */
export function getDatabase(): DrizzlePostgres | DrizzlePGlite {
  if (!dbClient) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbClient;
}

/**
 * Get SQL client (must be initialized first)
 */
export function getSQL(): ReturnType<typeof postgres> | PGliteClient {
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
    if (isPGlite) {
      // PGlite uses close() method
      await (sqlClient as PGliteClient).close();
    } else {
      // postgres uses end() method
      await (sqlClient as ReturnType<typeof postgres>).end();
    }
    sqlClient = null;
    dbClient = null;
    isPGlite = false;
  }
}


