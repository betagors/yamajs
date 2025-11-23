import type { YamaPlugin } from "@yama/core";
import { registerDatabaseAdapter } from "@yama/core";
import { postgresqlAdapter } from "./adapter.js";
import {
  initDatabase,
  getDatabase,
  getSQL,
  closeDatabase,
} from "./client.js";
import { generateDrizzleSchema } from "./drizzle-schema.js";
import {
  generateMigrationSQL,
  generateMigrationFile,
  generateSQLFromSteps,
  computeMigrationChecksum,
  getMigrationTableSQL,
  getMigrationRunsTableSQL,
} from "./migrations.js";
import { generateMapper } from "./mapper.js";
import { generateRepository } from "./repository.js";
import {
  createDataSnapshot,
  restoreFromSnapshot,
  deleteSnapshot,
  listSnapshots,
} from "./snapshots.js";

/**
 * PostgreSQL database plugin
 */
const plugin: YamaPlugin = {
  name: "@yama/db-postgres",
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

