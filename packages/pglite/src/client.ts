import { drizzle } from "drizzle-orm/pglite";
import type { DatabaseConfig } from "@yama/core";

type PGliteClient = InstanceType<typeof import("@electric-sql/pglite").PGlite>;
type DrizzlePGlite = ReturnType<typeof drizzle>;

let dbClient: DrizzlePGlite | null = null;
let sqlClient: PGliteClient | null = null;

/**
 * Initialize database connection
 */
export async function initDatabase(config: DatabaseConfig): Promise<{
  db: DrizzlePGlite;
  sql: PGliteClient;
}> {
  if (dbClient && sqlClient) {
    return { db: dbClient, sql: sqlClient };
  }

  try {
    // Dynamically import PGlite
    const { PGlite } = await import("@electric-sql/pglite");

    // Create PGlite client
    const options: { dataDir?: string } = {};
    if (config.url && config.url !== ":memory:" && config.url !== "pglite") {
      options.dataDir = config.url;
    }

    const pgliteClient = new PGlite(options);
    await pgliteClient.waitReady;

    sqlClient = pgliteClient;
    
    // Use drizzle-orm/pglite adapter (official Drizzle support for PGlite)
    dbClient = drizzle(pgliteClient);

    return { db: dbClient, sql: sqlClient };
  } catch (error) {
    throw new Error(
      `Failed to initialize PGlite. Make sure @electric-sql/pglite is installed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get database client (must be initialized first)
 */
export function getDatabase(): DrizzlePGlite {
  if (!dbClient) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbClient;
}

/**
 * Get SQL client (must be initialized first)
 * Returns a wrapper that provides postgres-like interface
 */
export function getSQL(): {
  unsafe: (query: string) => Promise<any[]>;
  begin: (callback: (tx: { unsafe: (query: string) => Promise<any[]> }) => Promise<void>) => Promise<void>;
} {
  if (!sqlClient) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  
  // Return a wrapper that provides postgres-like interface
  return {
    async unsafe(query: string): Promise<any[]> {
      const result = await sqlClient!.query(query);
      return result.rows || [];
    },
    async begin(callback: (tx: { unsafe: (query: string) => Promise<any[]> }) => Promise<void>): Promise<void> {
      await sqlClient!.exec("BEGIN");
      try {
        const tx = {
          async unsafe(query: string): Promise<any[]> {
            const result = await sqlClient!.query(query);
            return result.rows || [];
          },
        };
        await callback(tx);
        await sqlClient!.exec("COMMIT");
      } catch (error) {
        await sqlClient!.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (sqlClient) {
    await sqlClient.close();
    sqlClient = null;
    dbClient = null;
  }
}

