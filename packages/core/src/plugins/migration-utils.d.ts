import type { YamaPlugin, PluginManifest } from "./base.js";
import type { PluginMigration } from "./migrations.js";
/**
 * Migration plan information
 */
export interface MigrationPlan {
    pluginName: string;
    currentVersion: string | null;
    targetVersion: string;
    migrations: PluginMigration[];
    canRollback: boolean;
}
/**
 * Validate migration SQL file syntax (basic check)
 * This is a simple validation - full SQL parsing would require a SQL parser
 */
export declare function validateMigrationFile(path: string): Promise<boolean>;
/**
 * Generate migration plan without executing
 */
export declare function getMigrationPlan(plugin: YamaPlugin, manifest: PluginManifest, installedVersion: string | null, currentVersion: string, sql?: any): Promise<MigrationPlan>;
/**
 * Format migration plan for CLI output
 */
export declare function formatMigrationPlan(plan: MigrationPlan): string;
/**
 * Get migration status for a plugin
 */
export declare function getPluginMigrationStatus(pluginName: string, plugin: YamaPlugin, manifest: PluginManifest, sql: any): Promise<{
    installedVersion: string | null;
    packageVersion: string;
    pendingMigrations: number;
    migrationHistory: Array<{
        version: string;
        migration_name: string;
        applied_at: Date;
        type: string;
    }>;
}>;
