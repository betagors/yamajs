import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type {
  DatabaseAdapter,
  DatabaseConnection,
} from "@betagors/yama-core";
import type { DatabaseConfig, YamaEntities } from "@betagors/yama-core";
import { generateDrizzleSchema } from "./drizzle-schema";
import { generateMigrationSQL } from "./migrations";

type DrizzlePostgres = ReturnType<typeof drizzlePostgres>;

let dbClient: DrizzlePostgres | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

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

    // Use regular PostgreSQL client
    sqlClient = postgres(config.url, {
      max: config.pool?.max || 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ...config.options,
    });

    // Create drizzle instance
    dbClient = drizzlePostgres(sqlClient) as DrizzlePostgres;

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
      await sqlClient.end();
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

