/**
 * Migration Runner
 * 
 * Executes plugin migrations with:
 * - Transaction support (atomic updates)
 * - Safety analysis
 * - Lock acquisition
 * - Lifecycle hooks
 * - Table sandbox enforcement (Phase 2)
 * - Dependency validation (Phase 2)
 */

import type { YamaPlugin, PluginManifest, PluginMigrationDefinition } from "../../../../../../../../../../../core/kernel/src/plugins/base.js";
import type { PluginMigration } from "../../../../../../../../../../../core/kernel/src/plugins/migrations.js";
import { MigrationLock, withMigrationLock } from "../../../../../../../../../../../core/kernel/src/plugins/migration-lock.js";
import {
    analyzeMigrationSafety,
    analyzeMultipleMigrations,
    type MigrationSafetyAnalysis
} from "../../../../../../../../../../../core/kernel/src/plugins/migration-safety.js";
import {
    validateTableAccess,
    inferPolicyFromPluginName,
    mergePolicies,
    formatSandboxViolations,
    type PluginTablePolicy,
    type SandboxValidationResult
} from "../../../../../../../../../../../core/kernel/src/plugins/table-sandbox.js";
import {
    canMigrationRun,
    resolveDependencies,
    formatDependencyResult,
    type DependencyResolutionResult
} from "../../../../../../../../../../../core/kernel/src/plugins/dependency-resolver.js";
import { getRuntime } from "../../../../../../../../../../../core/kernel/src/platform/index.js";
import { computeChecksum } from "../../../../../../../../../../../core/kernel/src/plugins/migrations.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

/**
 * Migration execution result
 */
export interface MigrationExecutionResult {
    success: boolean;
    migrationsRun: number;
    failedMigration?: {
        version: string;
        error: Error;
    };
    safetyAnalysis: MigrationSafetyAnalysis;
    duration: number;
    rolledBack: boolean;
}

/**
 * Migration runner options
 */
export interface MigrationRunnerOptions {
    /** Whether to run migrations in a transaction (default: true for PostgreSQL) */
    transactional?: boolean;

    /** Whether to perform dry run without executing (default: false) */
    dryRun?: boolean;

    /** Skip safety analysis (default: false) */
    skipSafetyAnalysis?: boolean;

    /** Force run even if destructive (default: false) */
    force?: boolean;

    /** Skip table sandbox enforcement (default: false) */
    skipSandboxCheck?: boolean;

    /** Skip dependency validation (default: false) */
    skipDependencyCheck?: boolean;

    /** Map of installed plugin versions for dependency checking */
    installedVersions?: Map<string, string>;

    /** Custom logger */
    logger?: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
    };
}

const defaultLogger = {
    info: (msg: string) => console.log(`[Migration] ${msg}`),
    warn: (msg: string) => console.warn(`[Migration] ⚠️  ${msg}`),
    error: (msg: string) => console.error(`[Migration] ❌ ${msg}`),
};

/**
 * Migration Runner - Executes plugin migrations safely
 */
export class MigrationRunner {
    private db: any;
    private options: Required<MigrationRunnerOptions>;

    constructor(db: any, options: MigrationRunnerOptions = {}) {
        this.db = db;
        this.options = {
            transactional: true,
            dryRun: false,
            skipSafetyAnalysis: false,
            force: false,
            skipSandboxCheck: false,
            skipDependencyCheck: false,
            installedVersions: new Map(),
            logger: defaultLogger,
            ...options,
        };
    }

    /**
     * Run migrations for a plugin
     */
    async run(
        plugin: YamaPlugin,
        manifest: PluginManifest,
        migrations: PluginMigration[],
        pluginDir: string
    ): Promise<MigrationExecutionResult> {
        const startTime = Date.now();
        const logger = this.options.logger;

        if (migrations.length === 0) {
            return {
                success: true,
                migrationsRun: 0,
                safetyAnalysis: {
                    safe: true,
                    requiresConfirmation: false,
                    requiresBackup: false,
                    destructiveOperations: [],
                    warnings: [],
                    affectedTables: [],
                    riskLevel: 'low',
                    summary: 'No migrations to run',
                },
                duration: 0,
                rolledBack: false,
            };
        }

        // Load and analyze all migration SQL
        const migrationContents: Array<{ name: string; sql: string }> = [];
        for (const migration of migrations) {
            const sql = await this.loadMigrationSQL(migration.migration, pluginDir);
            if (typeof sql === 'string') {
                migrationContents.push({ name: migration.toVersion, sql });
            }
        }

        // Phase 2: Table sandbox validation
        if (!this.options.skipSandboxCheck) {
            const inferredPolicy = inferPolicyFromPluginName(plugin.name);
            const policy = manifest.tablePolicy
                ? mergePolicies(inferredPolicy, manifest.tablePolicy as Partial<PluginTablePolicy>)
                : inferredPolicy;

            for (const { name, sql } of migrationContents) {
                const sandboxResult = validateTableAccess(sql, policy);
                if (!sandboxResult.valid) {
                    logger.error(`Table sandbox violation in migration ${name}:`);
                    logger.error(formatSandboxViolations(sandboxResult));
                    return {
                        success: false,
                        migrationsRun: 0,
                        safetyAnalysis: {
                            safe: false,
                            requiresConfirmation: true,
                            requiresBackup: false,
                            destructiveOperations: [],
                            warnings: [`Table sandbox violation in migration ${name}`],
                            affectedTables: sandboxResult.tablesAccessed,
                            riskLevel: 'high',
                            summary: `Plugin "${plugin.name}" attempted to access unauthorized tables`,
                        },
                        duration: Date.now() - startTime,
                        rolledBack: false,
                    };
                }
            }
            logger.info(`✅ Table sandbox: all migrations comply with policy`);
        }

        // Phase 2: Dependency validation
        if (!this.options.skipDependencyCheck && this.options.installedVersions) {
            const depResult = resolveDependencies(
                plugin.name,
                manifest,
                this.options.installedVersions
            );

            if (!depResult.satisfied) {
                logger.error(`Missing plugin dependencies:`);
                logger.error(formatDependencyResult(depResult));
                return {
                    success: false,
                    migrationsRun: 0,
                    safetyAnalysis: {
                        safe: false,
                        requiresConfirmation: true,
                        requiresBackup: false,
                        destructiveOperations: [],
                        warnings: depResult.missing.map(m => m.reason),
                        affectedTables: [],
                        riskLevel: 'high',
                        summary: `Plugin dependencies not satisfied: ${depResult.missing.map(m => m.dependency.plugin).join(', ')}`,
                    },
                    duration: Date.now() - startTime,
                    rolledBack: false,
                };
            }
            logger.info(`✅ Dependencies: all requirements satisfied`);
        }

        // Perform safety analysis
        let safetyAnalysis: MigrationSafetyAnalysis;
        if (this.options.skipSafetyAnalysis) {
            safetyAnalysis = {
                safe: true,
                requiresConfirmation: false,
                requiresBackup: false,
                destructiveOperations: [],
                warnings: [],
                affectedTables: [],
                riskLevel: 'low',
                summary: 'Safety analysis skipped',
            };
        } else {
            safetyAnalysis = analyzeMultipleMigrations(migrationContents);
        }

        // Log safety analysis
        if (!safetyAnalysis.safe) {
            logger.warn(`Safety analysis: ${safetyAnalysis.summary}`);
            for (const warning of safetyAnalysis.warnings) {
                logger.warn(warning);
            }
        }

        // Check if we should proceed
        if (safetyAnalysis.requiresConfirmation && !this.options.force && !this.options.dryRun) {
            return {
                success: false,
                migrationsRun: 0,
                safetyAnalysis,
                duration: Date.now() - startTime,
                rolledBack: false,
            };
        }

        // Dry run mode
        if (this.options.dryRun) {
            logger.info(`[DRY RUN] Would run ${migrations.length} migration(s)`);
            for (const migration of migrations) {
                logger.info(`  - ${migration.fromVersion} → ${migration.toVersion}`);
            }
            return {
                success: true,
                migrationsRun: 0,
                safetyAnalysis,
                duration: Date.now() - startTime,
                rolledBack: false,
            };
        }

        // Run with lock
        return await withMigrationLock(this.db, plugin.name, async () => {
            return await this.executeWithTransaction(
                plugin,
                migrations,
                pluginDir,
                safetyAnalysis,
                startTime
            );
        });
    }

    /**
     * Execute migrations within a transaction
     */
    private async executeWithTransaction(
        plugin: YamaPlugin,
        migrations: PluginMigration[],
        pluginDir: string,
        safetyAnalysis: MigrationSafetyAnalysis,
        startTime: number
    ): Promise<MigrationExecutionResult> {
        const logger = this.options.logger;
        const supportsTransactions = await this.supportsTransactionalDDL();
        const useTransaction = this.options.transactional && supportsTransactions;

        let migrationsRun = 0;
        let rolledBack = false;

        try {
            if (useTransaction) {
                await this.db.unsafe('BEGIN');
                logger.info('Started transaction');
            }

            for (const migration of migrations) {
                logger.info(`Running migration ${migration.fromVersion} → ${migration.toVersion}...`);

                try {
                    // Call onBeforeMigrate hook if present
                    if (plugin.onBeforeMigrate) {
                        await plugin.onBeforeMigrate(migration.fromVersion, migration.toVersion);
                    }

                    // Execute migration
                    await this.executeSingleMigration(migration, pluginDir);
                    migrationsRun++;

                    // Call onAfterMigrate hook if present
                    if (plugin.onAfterMigrate) {
                        await plugin.onAfterMigrate(migration.fromVersion, migration.toVersion);
                    }

                    logger.info(`  ✓ Migration ${migration.toVersion} completed`);
                } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));

                    // Call onMigrationError hook if present
                    if (plugin.onMigrationError) {
                        await plugin.onMigrationError(err, migration.fromVersion, migration.toVersion);
                    }

                    if (useTransaction) {
                        await this.db.unsafe('ROLLBACK');
                        rolledBack = true;
                        logger.error(`Migration failed, rolled back transaction: ${err.message}`);
                    } else {
                        logger.error(`Migration failed: ${err.message}`);
                    }

                    return {
                        success: false,
                        migrationsRun,
                        failedMigration: {
                            version: migration.toVersion,
                            error: err,
                        },
                        safetyAnalysis,
                        duration: Date.now() - startTime,
                        rolledBack,
                    };
                }
            }

            // Update plugin version
            const latestVersion = migrations[migrations.length - 1].toVersion;
            await this.updatePluginVersion(plugin.name, latestVersion);

            if (useTransaction) {
                await this.db.unsafe('COMMIT');
                logger.info('Committed transaction');
            }

            return {
                success: true,
                migrationsRun,
                safetyAnalysis,
                duration: Date.now() - startTime,
                rolledBack: false,
            };
        } catch (error) {
            // Unexpected error - try to rollback
            if (useTransaction && !rolledBack) {
                try {
                    await this.db.unsafe('ROLLBACK');
                    rolledBack = true;
                    logger.error('Rolled back transaction due to error');
                } catch {
                    // Rollback failed, connection might be broken
                }
            }

            throw error;
        }
    }

    /**
     * Execute a single migration
     */
    private async executeSingleMigration(
        migration: PluginMigration,
        pluginDir: string
    ): Promise<void> {
        const { migration: mig } = migration;
        const upScript = await this.loadMigrationSQL(mig, pluginDir);

        if (typeof upScript === 'string') {
            // SQL file
            await this.db.unsafe(upScript);
        } else {
            // Function - call it with db context
            await upScript();
        }

        // Record migration in history
        const checksum = typeof upScript === 'string'
            ? computeChecksum(upScript)
            : 'function';

        await this.db`
      INSERT INTO _yama_plugin_migrations 
      (plugin_name, plugin_version, migration_name, migration_type, checksum)
      VALUES (
        ${migration.pluginName},
        ${migration.toVersion},
        ${`migration_${migration.toVersion}`},
        ${migration.migration.type || 'schema'},
        ${checksum}
      )
      ON CONFLICT (plugin_name, migration_name) DO NOTHING
    `;
    }

    /**
     * Load migration SQL content
     */
    private async loadMigrationSQL(
        migration: PluginMigrationDefinition,
        pluginDir: string
    ): Promise<string | (() => Promise<void> | void)> {
        const script = migration.up;

        if (typeof script === 'string') {
            // It's a file path - resolve relative to plugin directory
            const filePath = path().join(pluginDir, script);
            if (!await fs().exists(filePath)) {
                throw new Error(`Migration file not found: ${filePath}`);
            }
            return await fs().readTextFile(filePath);
        }

        // It's a function
        return script;
    }

    /**
     * Update plugin version record
     */
    private async updatePluginVersion(pluginName: string, version: string): Promise<void> {
        const existing = await this.db`
      SELECT installed_version FROM _yama_plugin_versions 
      WHERE plugin_name = ${pluginName}
    `;

        if (existing?.[0]) {
            await this.db`
        UPDATE _yama_plugin_versions
        SET 
          previous_version = installed_version,
          installed_version = ${version},
          updated_at = NOW()
        WHERE plugin_name = ${pluginName}
      `;
        } else {
            await this.db`
        INSERT INTO _yama_plugin_versions 
        (plugin_name, installed_version)
        VALUES (${pluginName}, ${version})
      `;
        }
    }

    /**
     * Check if database supports transactional DDL
     */
    private async supportsTransactionalDDL(): Promise<boolean> {
        try {
            // PostgreSQL supports transactional DDL
            const result = await this.db.unsafe(
                `SELECT version() as version`
            );
            const version = result?.[0]?.version || '';
            return version.toLowerCase().includes('postgresql');
        } catch {
            return false;
        }
    }
}

/**
 * Create a migration runner instance
 */
export function createMigrationRunner(
    db: any,
    options?: MigrationRunnerOptions
): MigrationRunner {
    return new MigrationRunner(db, options);
}

/**
 * Run migrations for a plugin (convenience function)
 */
export async function runPluginMigrations(
    db: any,
    plugin: YamaPlugin,
    manifest: PluginManifest,
    migrations: PluginMigration[],
    pluginDir: string,
    options?: MigrationRunnerOptions
): Promise<MigrationExecutionResult> {
    const runner = new MigrationRunner(db, options);
    return runner.run(plugin, manifest, migrations, pluginDir);
}

/**
 * Dry run migrations to see what would happen
 */
export async function dryRunMigrations(
    db: any,
    plugin: YamaPlugin,
    manifest: PluginManifest,
    migrations: PluginMigration[],
    pluginDir: string
): Promise<MigrationExecutionResult> {
    const runner = new MigrationRunner(db, { dryRun: true });
    return runner.run(plugin, manifest, migrations, pluginDir);
}
