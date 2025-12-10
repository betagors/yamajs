import type { YamaPlugin, PluginContext } from "@betagors/yama-core";
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

  async init(opts: Record<string, unknown>, context: PluginContext) {
    // Register the database adapter
    registerDatabaseAdapter("postgresql", () => postgresqlAdapter);

    // Register database service in context
    const pluginApi = {
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

    // Register as database service in context
    context.registerService("database", pluginApi);
    context.logger.info(`Registered database service for @betagors/yama-postgres`);

    return pluginApi;
  },

  async onHealthCheck() {
    // Basic health check - in a real implementation, test database connection
    return {
      healthy: true,
      details: {
        adapter: "postgresql",
      },
    };
  },
};

export default plugin;

