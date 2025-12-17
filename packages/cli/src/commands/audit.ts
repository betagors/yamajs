import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
    getAuditStats,
    cleanupExpiredAuditEntries,
    formatAuditStats,
    formatAuditCleanupResult,
    loadEnvFile,
    resolveEnvVars,
    type AuditConfig,
} from "@yamajs/core";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";

interface AuditStatsOptions {
    config?: string;
}

interface AuditCleanupOptions {
    config?: string;
    retention?: string;
    archive?: string;
    dryRun?: boolean;
    force?: boolean;
}

/**
 * Show audit log statistics
 */
export async function auditStatsCommand(options: AuditStatsOptions): Promise<void> {
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
            const auditConfig: AuditConfig = resolvedConfig.audit || { enabled: true, retention: "90d" };
            const stats = await getAuditStats(sql, auditConfig);

            console.log("");
            console.log(formatAuditStats(stats));
            console.log("");

            if (stats.expiredCount > 0) {
                warning(`${stats.expiredCount} entries are past retention. Run 'yama audit cleanup' to remove.`);
            }

            if (stats.totalEntries > 1000000) {
                info(`You have ${stats.totalEntries.toLocaleString()} audit entries.`);
                info(`Consider archiving old entries: 'yama audit cleanup --archive ./audit-archive.json'`);
            }
        } finally {
            dbPlugin.client.closeDatabase();
        }
    } catch (err) {
        error(`Failed to get audit stats: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}

/**
 * Cleanup expired audit entries
 */
export async function auditCleanupCommand(options: AuditCleanupOptions): Promise<void> {
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
            const auditConfig: AuditConfig = resolvedConfig.audit || { enabled: true, retention: "90d" };

            // Get stats first to show what will be deleted
            const stats = await getAuditStats(sql, auditConfig);

            const retention = options.retention || auditConfig.retention || "90d";
            info(`Retention policy: ${retention}`);
            info(`Entries to delete: ${stats.expiredCount}`);

            if (options.archive) {
                info(`Will archive to: ${options.archive}`);
            }
            console.log("");

            if (stats.expiredCount === 0) {
                success("No expired audit entries to cleanup.");
                return;
            }

            // Confirm unless using --force
            if (!options.force && !options.dryRun) {
                const confirmed = await confirm(
                    `Delete ${stats.expiredCount} expired audit entries?`,
                    false
                );
                if (!confirmed) {
                    info("Cleanup cancelled.");
                    return;
                }
            }

            // Execute cleanup
            const result = await cleanupExpiredAuditEntries(sql, auditConfig, {
                dryRun: options.dryRun,
                retention: options.retention,
                archivePath: options.archive,
            });

            console.log("");
            console.log(formatAuditCleanupResult(result));

            if (!result.dryRun) {
                success("Cleanup complete!");
            }
        } finally {
            dbPlugin.client.closeDatabase();
        }
    } catch (err) {
        error(`Failed to cleanup audit log: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
