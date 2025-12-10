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
      let PGlite: typeof import("@electric-sql/pglite").PGlite;
      try {
        const pgliteModule = await import("@electric-sql/pglite");
        PGlite = pgliteModule.PGlite;
      } catch (importError) {
        throw new Error(
          `Failed to import @electric-sql/pglite. Make sure it's installed: ${importError instanceof Error ? importError.message : String(importError)}`
        );
      }

      // Create PGlite client
      const options: { dataDir?: string } = {};
      let dbMode = "persistent";
      
      if (config.url === ":memory:") {
        // Explicitly in-memory - don't set dataDir
        // options.dataDir is undefined, which means in-memory
        dbMode = "in-memory";
      } else if (config.url && config.url !== "pglite" && config.url.trim() !== "") {
        // Custom path provided
        options.dataDir = config.url;
        dbMode = `custom path: ${config.url}`;
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
        dbMode = `persistent: ${defaultPath}`;
      }

      // Try to create PGlite instance
      let pgliteClient: InstanceType<typeof PGlite>;
      try {
        pgliteClient = new PGlite(options);
      } catch (constructorError) {
        const errorMsg = constructorError instanceof Error ? constructorError.message : String(constructorError);
        // Check for common WASM initialization errors
        if (errorMsg.includes("Aborted") || errorMsg.includes("abort")) {
          throw new Error(
            `PGlite WASM initialization failed. This usually indicates:\n` +
            `  1. Node.js version incompatibility (try Node.js 18+)\n` +
            `  2. Missing WASM support in your environment\n` +
            `  3. Memory/resource constraints\n\n` +
            `Original error: ${errorMsg}\n` +
            `Database mode: ${dbMode}\n` +
            `Node.js version: ${process.version}\n` +
            `Platform: ${process.platform} ${process.arch}`
          );
        }
        throw constructorError;
      }

      // Wait for PGlite to be ready
      try {
        await pgliteClient.waitReady;
      } catch (readyError) {
        const errorMsg = readyError instanceof Error ? readyError.message : String(readyError);
        if (errorMsg.includes("Aborted") || errorMsg.includes("abort")) {
          throw new Error(
            `PGlite failed to become ready. WASM initialization error.\n` +
            `This usually indicates Node.js version incompatibility or missing WASM support.\n` +
            `Try: Node.js 18+ or check your environment supports WebAssembly.\n\n` +
            `Original error: ${errorMsg}\n` +
            `Database mode: ${dbMode}`
          );
        }
        throw readyError;
      }

      sqlClient = pgliteClient;
      
      // Use drizzle-orm/pglite adapter (official Drizzle support for PGlite)
      dbClient = drizzle(pgliteClient);

      return { db: dbClient, sql: sqlClient };
    } catch (error) {
      // Re-throw if it's already a detailed error
      if (error instanceof Error && error.message.includes("PGlite")) {
        throw error;
      }
      // Otherwise wrap with helpful context
      throw new Error(
        `Failed to initialize PGlite database.\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}\n` +
        `\nTroubleshooting:\n` +
        `  - PGlite doesn't require a DATABASE_URL (it's optional)\n` +
        `  - Use ":memory:" for in-memory database\n` +
        `  - Omit URL to use default persistent storage\n` +
        `  - Ensure Node.js 18+ is installed\n` +
        `  - Check that @electric-sql/pglite is installed: npm install @electric-sql/pglite`
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

