import { drizzle } from "drizzle-orm/pglite";
import type {
  DatabaseAdapter,
  DatabaseConnection,
} from "@betagors/yama-core";
import type { DatabaseConfig, YamaEntities } from "@betagors/yama-core";
import { generateDrizzleSchema } from "./drizzle-schema.ts";
import { generateMigrationSQL } from "./migrations.ts";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

type PGliteClient = InstanceType<typeof import("@electric-sql/pglite").PGlite>;
type DrizzlePGlite = ReturnType<typeof drizzle>;

let dbClient: DrizzlePGlite | null = null;
let sqlClient: PGliteClient | null = null;

/**
 * Get default database path (.yama/data/db/pglite)
 */
function getDefaultDbPath(): string {
  // Use current working directory - .yama should be in the project root
  // where yama.yaml is located
  return join(process.cwd(), ".yama", "data", "db", "pglite");
}

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
      const options: { dataDir?: string } = {};
      
      if (config.url === ":memory:") {
        // Explicitly in-memory - don't set dataDir
        // options.dataDir is undefined, which means in-memory
      } else if (config.url && config.url !== "pglite") {
        // Custom path provided
        options.dataDir = config.url;
      } else {
        // Default: use persistent storage at .yama/data/db/pglite
        const defaultPath = getDefaultDbPath();
        // Ensure the entire directory path exists (PGlite needs the parent directory)
        // Create .yama/data/db directory structure
        const yamaDir = join(process.cwd(), ".yama");
        const dataDir = join(yamaDir, "data");
        const dbDir = join(dataDir, "db");
        
        try {
          // Create directories recursively if they don't exist
          if (!existsSync(yamaDir)) {
            mkdirSync(yamaDir, { recursive: true });
          }
          if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
          }
          if (!existsSync(dbDir)) {
            mkdirSync(dbDir, { recursive: true });
          }
        } catch (err) {
          throw new Error(
            `Failed to create database directory at ${dbDir}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        options.dataDir = defaultPath;
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

