import { drizzle } from "drizzle-orm/pglite";
import type {
  DatabaseAdapter,
  DatabaseConnection,
} from "@yama/core";
import type { DatabaseConfig, YamaEntities } from "@yama/core";
import { generateDrizzleSchema } from "./drizzle-schema.ts";
import { generateMigrationSQL } from "./migrations.ts";

type PGliteClient = InstanceType<typeof import("@electric-sql/pglite").PGlite>;
type DrizzlePGlite = ReturnType<typeof drizzle>;

let dbClient: DrizzlePGlite | null = null;
let sqlClient: PGliteClient | null = null;

/**
 * PGlite database adapter
 * Uses PGlite's native query interface with Drizzle ORM via a custom driver
 */
export const pgliteAdapter: DatabaseAdapter = {
  async init(config: DatabaseConfig): Promise<DatabaseConnection> {
    if (dbClient && sqlClient) {
      return { db: dbClient, sql: sqlClient };
    }

    try {
      // Dynamically import PGlite
      const { PGlite } = await import("@electric-sql/pglite");

      // Create PGlite client
      // If config.url is provided and not ":memory:" or "pglite", use it as data directory
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
      await sqlClient.close();
      sqlClient = null;
      dbClient = null;
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

