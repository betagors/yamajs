import type { YamaPlugin, PluginManifest, PluginMigrationDefinition } from "./base.js";
/**
 * SQL for plugin migrations tracking table
 */
export declare const PLUGIN_MIGRATIONS_TABLE_SQL = "\n  CREATE TABLE IF NOT EXISTS _yama_plugin_migrations (\n    id SERIAL PRIMARY KEY,\n    plugin_name VARCHAR(255) NOT NULL,\n    plugin_version VARCHAR(50) NOT NULL,\n    migration_name VARCHAR(255) NOT NULL,\n    migration_type VARCHAR(50) DEFAULT 'schema',\n    checksum VARCHAR(64),\n    applied_at TIMESTAMP DEFAULT NOW(),\n    UNIQUE(plugin_name, migration_name)\n  );\n";
/**
 * SQL for plugin versions tracking table
 */
export declare const PLUGIN_VERSIONS_TABLE_SQL = "\n  CREATE TABLE IF NOT EXISTS _yama_plugin_versions (\n    plugin_name VARCHAR(255) PRIMARY KEY,\n    installed_version VARCHAR(50) NOT NULL,\n    previous_version VARCHAR(50),\n    installed_at TIMESTAMP DEFAULT NOW(),\n    updated_at TIMESTAMP DEFAULT NOW()\n  );\n";
/**
 * Plugin migration information
 */
export interface PluginMigration {
    pluginName: string;
    fromVersion: string;
    toVersion: string;
    migration: PluginMigrationDefinition;
}
/**
 * Migration execution result
 */
export interface MigrationResult {
    success: boolean;
    error?: Error;
    migration: PluginMigration;
}
/**
 * Get plugin package directory path
 */
export declare function getPluginPackageDir(packageName: string, projectDir?: string): Promise<string>;
/**
 * Ensure plugin migration tables exist
 */
export declare function ensurePluginMigrationTables(sql: any): Promise<void>;
/**
 * Get installed plugin version from database
 */
export declare function getInstalledPluginVersion(pluginName: string, sql: any): Promise<string | null>;
/**
 * Compute checksum for migration content
 */
export declare function computeChecksum(content: string): string;
/**
 * Get pending migrations for a plugin
 */
export declare function getPendingPluginMigrations(plugin: YamaPlugin, manifest: PluginManifest, installedVersion: string | null, currentVersion: string): Promise<PluginMigration[]>;
/**
 * Execute a plugin migration
 */
export declare function executePluginMigration(migration: PluginMigration, sql: any, pluginDir: string): Promise<void>;
/**
 * Rollback a plugin migration
 */
export declare function rollbackPluginMigration(pluginName: string, toVersion: string, sql: any, pluginDir: string, manifest: PluginManifest): Promise<void>;
/**
 * Update plugin version record
 */
export declare function updatePluginVersion(pluginName: string, version: string, sql: any): Promise<void>;
/**
 * Get migration history for a plugin
 */
export declare function getPluginMigrationHistory(pluginName: string, sql: any): Promise<Array<{
    version: string;
    migration_name: string;
    applied_at: Date;
    type: string;
}>>;
