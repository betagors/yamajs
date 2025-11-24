import type { YamaPlugin } from "@betagors/yama-core";
import { registerDatabaseAdapter } from "@betagors/yama-core";
import { postgresqlAdapter } from "./adapter";
import {
  initDatabase,
  getDatabase,
  getSQL,
  closeDatabase,
} from "./client";
import { generateDrizzleSchema } from "./drizzle-schema";
import {
  generateMigrationSQL,
  generateMigrationFile,
  generateSQLFromSteps,
  computeMigrationChecksum,
  getMigrationTableSQL,
  getMigrationRunsTableSQL,
} from "./migrations";
import { generateMapper } from "./mapper";
import { generateRepository } from "./repository";
import {
  createDataSnapshot,
  restoreFromSnapshot,
  deleteSnapshot,
  listSnapshots,
} from "./snapshots";

/**
 * PostgreSQL database plugin
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-postgres",
  category: "database",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts?: Record<string, unknown>) {
    // Register the database adapter
    registerDatabaseAdapter("postgresql", () => postgresqlAdapter);

    // Return plugin API
    return {
      adapter: postgresqlAdapter,
      client: {
        initDatabase,
        getDatabase,
        getSQL,
        closeDatabase,
      },
      migrations: {
        generate: generateMigrationSQL,
        generateFile: generateMigrationFile,
        generateFromSteps: generateSQLFromSteps,
        computeChecksum: computeMigrationChecksum,
        getMigrationTableSQL,
        getMigrationRunsTableSQL,
      },
      schema: {
        generateDrizzleSchema,
      },
      codegen: {
        generateMapper,
        generateRepository,
      },
      snapshots: {
        create: createDataSnapshot,
        restore: restoreFromSnapshot,
        delete: deleteSnapshot,
        list: listSnapshots,
      },
    };
  },
};

export default plugin;

