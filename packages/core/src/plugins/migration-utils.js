import { readFileSync, existsSync } from "fs";
import { getPendingPluginMigrations, getInstalledPluginVersion, getPluginMigrationHistory, } from "./migrations.js";
/**
 * Validate migration SQL file syntax (basic check)
 * This is a simple validation - full SQL parsing would require a SQL parser
 */
export async function validateMigrationFile(path) {
    if (!existsSync(path)) {
        return false;
    }
    try {
        const content = readFileSync(path, "utf-8");
        // Basic validation: check if it's not empty and contains SQL-like content
        if (!content.trim()) {
            return false;
        }
        // Check for common SQL keywords (very basic check)
        const sqlKeywords = [
            "CREATE",
            "ALTER",
            "DROP",
            "INSERT",
            "UPDATE",
            "DELETE",
            "SELECT",
        ];
        const hasSqlKeyword = sqlKeywords.some((keyword) => content.toUpperCase().includes(keyword));
        return hasSqlKeyword;
    }
    catch {
        return false;
    }
}
/**
 * Generate migration plan without executing
 */
export async function getMigrationPlan(plugin, manifest, installedVersion, currentVersion, sql) {
    const pending = await getPendingPluginMigrations(plugin, manifest, installedVersion, currentVersion);
    // Check if rollback is possible (all migrations have down scripts)
    const canRollback = pending.length > 0 &&
        pending.every((m) => m.migration.down !== undefined);
    return {
        pluginName: plugin.name,
        currentVersion: installedVersion,
        targetVersion: currentVersion,
        migrations: pending,
        canRollback,
    };
}
/**
 * Format migration plan for CLI output
 */
export function formatMigrationPlan(plan) {
    const lines = [];
    lines.push(`Plugin: ${plan.pluginName}`);
    lines.push(`Version: ${plan.currentVersion || "not installed"} → ${plan.targetVersion}`);
    lines.push(`Migrations: ${plan.migrations.length}`);
    lines.push("");
    if (plan.migrations.length === 0) {
        lines.push("  No migrations to apply");
    }
    else {
        for (const migration of plan.migrations) {
            const type = migration.migration.type || "schema";
            const desc = migration.migration.description || "No description";
            const hasRollback = migration.migration.down !== undefined;
            lines.push(`  ${migration.toVersion} (${type})${hasRollback ? " [rollbackable]" : ""}`);
            if (desc !== "No description") {
                lines.push(`    ${desc}`);
            }
        }
    }
    if (plan.migrations.length > 0) {
        lines.push("");
        lines.push(`Rollback: ${plan.canRollback ? "Available" : "Not available (missing down migrations)"}`);
    }
    return lines.join("\n");
}
/**
 * Get migration status for a plugin
 */
export async function getPluginMigrationStatus(pluginName, plugin, manifest, sql) {
    const installedVersion = await getInstalledPluginVersion(pluginName, sql);
    const packageVersion = plugin.version || "0.0.0";
    const pending = await getPendingPluginMigrations(plugin, manifest, installedVersion, packageVersion);
    const history = await getPluginMigrationHistory(pluginName, sql);
    return {
        installedVersion,
        packageVersion,
        pendingMigrations: pending.length,
        migrationHistory: history,
    };
}
//# sourceMappingURL=migration-utils.js.map