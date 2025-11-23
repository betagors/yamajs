import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type {
  DatabaseAdapter,
  DatabaseConnection,
} from "@yama/core";
import type { DatabaseConfig, YamaEntities } from "@yama/core";
import { generateDrizzleSchema } from "./drizzle-schema.js";
import { generateMigrationSQL } from "./migrations.js";

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
 * PostgreSQL database adapter
 */
export const postgresqlAdapter: DatabaseAdapter = {
  async init(config: DatabaseConfig): Promise<DatabaseConnection> {
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
      ...config.options,
    });

    // Create drizzle instance
    dbClient = drizzlePostgres(sqlClient) as DrizzlePostgres;
    isPGlite = false;

    return { db: dbClient, sql: sqlClient };
  },

  getClient(): unknown {
    if (!dbClient) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return dbClient;
  },

  getSQL(): unknown {
    if (!sqlClient) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return sqlClient;
  },

  async close(): Promise<void> {
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
  },

  async generateSchema(entities: YamaEntities): Promise<string> {
    return generateDrizzleSchema(entities);
  },

  async generateMigration(
    entities: YamaEntities,
    migrationName: string
  ): Promise<string> {
    return generateMigrationSQL(entities, migrationName);
  },
};

