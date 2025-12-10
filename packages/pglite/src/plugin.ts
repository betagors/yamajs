import type { YamaPlugin, PluginContext } from "@betagors/yama-core";
import { registerDatabaseAdapter } from "@betagors/yama-core";
import { pgliteAdapter } from "./adapter.ts";
import {
  initDatabase,
  getDatabase,
  getSQL,
  closeDatabase,
} from "./client.ts";
import { generateDrizzleSchema } from "./drizzle-schema.ts";
import {
  generateMigrationSQL,
  generateMigrationFile,
  generateSQLFromSteps,
  computeMigrationChecksum,
  getMigrationTableSQL,
  getMigrationRunsTableSQL,
} from "./migrations.ts";
import { generateMapper } from "./mapper.ts";
import { generateRepository } from "./repository.ts";
import {
  createDataSnapshot,
  restoreFromSnapshot,
  deleteSnapshot,
  listSnapshots,
} from "./snapshots.ts";

/**
 * PGlite database plugin
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-pglite",
  category: "database",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts: Record<string, unknown>, context: PluginContext) {
    // Register the database adapter
    registerDatabaseAdapter("pglite", () => pgliteAdapter);

    // Return plugin API
    return {
      adapter: pgliteAdapter,
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

