import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig } from "../utils/file-utils.ts";
import {
    getInvalidIndexes,
    recoverInvalidIndexes,
    formatIndexRecoveryResult,
    formatIndexHealthCheck,
    checkTableIndexHealth,
    loadEnvFile,
    resolveEnvVars,
} from "@yamajs/kernel";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { table } from "table";

interface CheckIndexesOptions {
    config?: string;
    table?: string;
    schema?: string;
}

interface FixIndexesOptions {
    config?: string;
    schema?: string;
    retry?: boolean;
    dryRun?: boolean;
    force?: boolean;
}

/**
 * Check for invalid indexes in the database
 */
export async function checkIndexesCommand(options: CheckIndexesOptions): Promise<void> {
    const configPath = options.config || findYamaConfig() || "yama.yaml";

    if (!existsSync(configPath)) {
        error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    try {
        loadEnvFile(configPath);
        const config = readYamaConfig(configPath) as any;
        const resolvedConfig = resolveEnvVars(config) as any;

        if (!resolvedConfig.database) {
            error("No database configuration found in yama.yaml");
            process.exit(1);
        }

        const dbPlugin = await getDatabasePlugin(resolvedConfig.plugins, configPath);
        await dbPlugin.client.initDatabase(resolvedConfig.database);
        const sql = dbPlugin.client.getSQL();

        try {
            if (options.table) {
                // Check specific table
                const result = await checkTableIndexHealth(sql, options.table, options.schema || "public");
                console.log("");
                console.log(formatIndexHealthCheck(result));
            } else {
                // Check all tables
                const invalidIndexes = await getInvalidIndexes(sql, { schema: options.schema });

                console.log("");
                if (invalidIndexes.length === 0) {
                    success("✅ All indexes are healthy!");
                    return;
                }

                warning(`Found ${invalidIndexes.length} invalid index(es):`);
                console.log("");

                const tableData = [
                    ["Index", "Table", "Schema", "Type", "Reason"],
                    ...invalidIndexes.map(idx => [
                        idx.indexName,
                        idx.tableName,
                        idx.schemaName,
                        idx.isUnique ? "UNIQUE" : "REGULAR",
                        idx.reason,
                    ]),
                ];

                console.log(table(tableData));

                info("Run 'yama schema fix-indexes' to repair invalid indexes.");
            }
        } finally {
            dbPlugin.client.closeDatabase();
        }
    } catch (err) {
        error(`Failed to check indexes: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}

/**
 * Fix invalid indexes (drop and optionally recreate)
 */
export async function fixIndexesCommand(options: FixIndexesOptions): Promise<void> {
    const configPath = options.config || findYamaConfig() || "yama.yaml";

    if (!existsSync(configPath)) {
        error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    try {
        loadEnvFile(configPath);
        const config = readYamaConfig(configPath) as any;
        const resolvedConfig = resolveEnvVars(config) as any;

        if (!resolvedConfig.database) {
            error("No database configuration found in yama.yaml");
            process.exit(1);
        }

        const dbPlugin = await getDatabasePlugin(resolvedConfig.plugins, configPath);
        await dbPlugin.client.initDatabase(resolvedConfig.database);
        const sql = dbPlugin.client.getSQL();

        try {
            // Check for invalid indexes first
            const invalidIndexes = await getInvalidIndexes(sql, { schema: options.schema });

            if (invalidIndexes.length === 0) {
                success("No invalid indexes found. Nothing to fix.");
                return;
            }

            info(`Found ${invalidIndexes.length} invalid index(es) to fix.`);

            if (options.retry) {
                info("Will attempt to recreate indexes after dropping.");
            } else {
                info("Will only drop invalid indexes (use --retry to recreate).");
            }
            console.log("");

            // Confirm unless dry-run or force
            if (!options.dryRun && !options.force) {
                const confirmed = await confirm(
                    `Proceed with fixing ${invalidIndexes.length} invalid index(es)?`,
                    false
                );
                if (!confirmed) {
                    info("Fix cancelled.");
                    return;
                }
            }

            // Execute recovery
            const result = await recoverInvalidIndexes(sql, {
                dryRun: options.dryRun,
                retryCreation: options.retry,
                schema: options.schema,
            });

            console.log("");
            console.log(formatIndexRecoveryResult(result));

            if (!result.dryRun && result.errors.length === 0) {
                success("Index recovery complete!");
            } else if (result.errors.length > 0) {
                warning("Some indexes could not be fixed. Check the errors above.");
            }
        } finally {
            dbPlugin.client.closeDatabase();
        }
    } catch (err) {
        error(`Failed to fix indexes: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
