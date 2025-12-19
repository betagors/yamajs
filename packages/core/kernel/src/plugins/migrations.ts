import { getRuntime } from "../../../../../../../../core/kernel/src/platform/index.js";
import { sha256Hex } from "../../../../../../../../core/kernel/src/platform/hash.js";
import semver from "semver";
import type { YamaPlugin, PluginManifest, PluginMigrationDefinition } from "../../../../../../../../core/kernel/src/plugins/base.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

/**
 * SQL for plugin migrations tracking table
 */
export const PLUGIN_MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _yama_plugin_migrations (
    id SERIAL PRIMARY KEY,
    plugin_name VARCHAR(255) NOT NULL,
    plugin_version VARCHAR(50) NOT NULL,
    migration_name VARCHAR(255) NOT NULL,
    migration_type VARCHAR(50) DEFAULT 'schema',
    checksum VARCHAR(64),
    applied_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plugin_name, migration_name)
  );
`;

/**
 * SQL for plugin versions tracking table
 */
export const PLUGIN_VERSIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _yama_plugin_versions (
    plugin_name VARCHAR(255) PRIMARY KEY,
    installed_version VARCHAR(50) NOT NULL,
    previous_version VARCHAR(50),
    installed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`;

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
/**
 * Get plugin package directory path
 */
export async function getPluginPackageDir(
  packageName: string,
  projectDir?: string
): Promise<string> {
  const fs = getRuntime().fs;
  const path = getRuntime().path;
  const modules = getRuntime().modules;

  try {
    const projectRoot = projectDir || getRuntime().env.cwd();
    let packagePath: string;

    try {
      packagePath = await modules.resolve(packageName, path.join(projectRoot, "package.json"));
    } catch {
      packagePath = await modules.resolve(packageName);
    }

    // Get the directory containing the resolved file
    let packageDir: string;
    if (await fs.exists(packagePath) && !await fs.exists(path.join(packagePath, "package.json"))) {
      // It's a file, get its directory
      packageDir = path.dirname(packagePath);
    } else {
      // It's likely a directory or index file
      packageDir = path.dirname(
        packagePath.replace(/\/[^/]+$/, "").replace(/\\[^\\]+$/, "")
      );
    }

    // Walk up to find package.json
    let currentPath = packageDir;
    while (currentPath !== path.dirname(currentPath)) {
      const packageJsonPath = path.join(currentPath, "package.json");
      if (await fs.exists(packageJsonPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }

    return packageDir;
  } catch (error) {
    throw new Error(
      `Could not resolve package directory for ${packageName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Ensure plugin migration tables exist
 */
export async function ensurePluginMigrationTables(sql: any): Promise<void> {
  try {
    await sql.unsafe(PLUGIN_MIGRATIONS_TABLE_SQL);
    await sql.unsafe(PLUGIN_VERSIONS_TABLE_SQL);
  } catch (error) {
    throw new Error(
      `Failed to create plugin migration tables: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get installed plugin version from database
 */
export async function getInstalledPluginVersion(
  pluginName: string,
  sql: any
): Promise<string | null> {
  try {
    const result = await sql`
      SELECT installed_version 
      FROM _yama_plugin_versions 
      WHERE plugin_name = ${pluginName}
    `;
    return result?.[0]?.installed_version || null;
  } catch (error) {
    // Table might not exist yet, return null
    return null;
  }
}

/**
 * Compute checksum for migration content
 */
export function computeChecksum(content: string): string {
  return sha256Hex(content).substring(0, 16);
}

/**
 * Get pending migrations for a plugin
 */
export async function getPendingPluginMigrations(
  plugin: YamaPlugin,
  manifest: PluginManifest,
  installedVersion: string | null,
  currentVersion: string
): Promise<PluginMigration[]> {
  if (!manifest.migrations || Object.keys(manifest.migrations).length === 0) {
    return [];
  }

  const pending: PluginMigration[] = [];
  const migrations = manifest.migrations;

  // Validate current version is valid semver
  if (!semver.valid(currentVersion)) {
    console.warn(
      `Plugin ${plugin.name} has invalid version "${currentVersion}", skipping migrations`
    );
    return [];
  }

  // Get all migration versions and filter/sort them
  const migrationVersions = Object.keys(migrations)
    .filter((v) => {
      if (!semver.valid(v)) {
        console.warn(
          `Plugin ${plugin.name} has invalid migration version "${v}", skipping`
        );
        return false;
      }

      if (!installedVersion) {
        // First install - include all migrations up to current version
        return semver.lte(v, currentVersion);
      }

      // Update - include migrations between installed and current version
      if (!semver.valid(installedVersion)) {
        console.warn(
          `Plugin ${plugin.name} has invalid installed version "${installedVersion}", treating as first install`
        );
        return semver.lte(v, currentVersion);
      }

      return semver.gt(v, installedVersion) && semver.lte(v, currentVersion);
    })
    .sort((a, b) => semver.compare(a, b));

  for (const version of migrationVersions) {
    pending.push({
      pluginName: plugin.name,
      fromVersion: installedVersion || "0.0.0",
      toVersion: version,
      migration: migrations[version],
    });
  }

  return pending;
}

/**
 * Load migration script (SQL file or function)
 */
/**
 * Load migration script (SQL file or function)
 */
async function loadMigrationScript(
  migration: PluginMigrationDefinition,
  pluginDir: string,
  direction: "up" | "down"
): Promise<string | (() => Promise<void> | void)> {
  const script = direction === "up" ? migration.up : migration.down;

  if (!script) {
    throw new Error(
      `Migration ${direction} script not found`
    );
  }

  if (typeof script === "string") {
    // It's a file path - resolve relative to plugin directory
    const filePath = path().join(pluginDir, script);
    if (!await fs().exists(filePath)) {
      throw new Error(
        `Migration file not found: ${filePath}`
      );
    }
    return fs().readTextFile(filePath);
  } else {
    // It's a function
    return script;
  }
}

/**
 * Execute a plugin migration
 */
export async function executePluginMigration(
  migration: PluginMigration,
  sql: any,
  pluginDir: string
): Promise<void> {
  const { migration: mig } = migration;

  // Load migration script
  const upScript = await loadMigrationScript(mig, pluginDir, "up");

  // Execute migration
  if (typeof upScript === "string") {
    // SQL file
    await sql.unsafe(upScript);
  } else {
    // Function - pass sql client as context
    await upScript();
  }

  // Record migration
  const checksum = typeof upScript === "string"
    ? computeChecksum(upScript)
    : "function";

  await sql`
    INSERT INTO _yama_plugin_migrations 
    (plugin_name, plugin_version, migration_name, migration_type, checksum)
    VALUES (
      ${migration.pluginName},
      ${migration.toVersion},
      ${`migration_${migration.toVersion}`},
      ${migration.migration.type || "schema"},
      ${checksum}
    )
    ON CONFLICT (plugin_name, migration_name) DO NOTHING
  `;
}

/**
 * Rollback a plugin migration
 */
export async function rollbackPluginMigration(
  pluginName: string,
  toVersion: string,
  sql: any,
  pluginDir: string,
  manifest: PluginManifest
): Promise<void> {
  if (!manifest.migrations) {
    throw new Error(`Plugin ${pluginName} has no migrations defined`);
  }

  // Get all applied migrations that need to be rolled back
  const appliedMigrations = await sql`
    SELECT plugin_version, migration_name
    FROM _yama_plugin_migrations
    WHERE plugin_name = ${pluginName}
    ORDER BY applied_at DESC
  `;

  if (!appliedMigrations || appliedMigrations.length === 0) {
    throw new Error(`No migrations found for plugin ${pluginName}`);
  }

  // Filter migrations that need to be rolled back (versions > toVersion)
  const migrationsToRollback = appliedMigrations.filter((m: any) => {
    const version = m.plugin_version;
    return semver.valid(version) && semver.gt(version, toVersion);
  });

  if (migrationsToRollback.length === 0) {
    return; // Nothing to rollback
  }

  // Rollback in reverse order
  for (const applied of migrationsToRollback) {
    const version = applied.plugin_version;
    const migrationDef = manifest.migrations[version];

    if (!migrationDef) {
      throw new Error(
        `Migration definition not found for version ${version} in plugin ${pluginName}`
      );
    }

    if (!migrationDef.down) {
      throw new Error(
        `Rollback migration (down) not defined for version ${version} in plugin ${pluginName}`
      );
    }

    // Load and execute down migration
    const downScript = await loadMigrationScript(migrationDef, pluginDir, "down");

    if (typeof downScript === "string") {
      await sql.unsafe(downScript);
    } else {
      await downScript();
    }

    // Remove migration record
    await sql`
      DELETE FROM _yama_plugin_migrations
      WHERE plugin_name = ${pluginName}
        AND migration_name = ${applied.migration_name}
    `;
  }
}

/**
 * Update plugin version record
 */
export async function updatePluginVersion(
  pluginName: string,
  version: string,
  sql: any
): Promise<void> {
  const existing = await sql`
    SELECT installed_version FROM _yama_plugin_versions 
    WHERE plugin_name = ${pluginName}
  `;

  if (existing?.[0]) {
    await sql`
      UPDATE _yama_plugin_versions
      SET 
        previous_version = installed_version,
        installed_version = ${version},
        updated_at = NOW()
      WHERE plugin_name = ${pluginName}
    `;
  } else {
    await sql`
      INSERT INTO _yama_plugin_versions 
      (plugin_name, installed_version)
      VALUES (${pluginName}, ${version})
    `;
  }
}

/**
 * Get migration history for a plugin
 */
export async function getPluginMigrationHistory(
  pluginName: string,
  sql: any
): Promise<Array<{ version: string; migration_name: string; applied_at: Date; type: string }>> {
  try {
    const result = await sql`
      SELECT plugin_version as version, migration_name, applied_at, migration_type as type
      FROM _yama_plugin_migrations
      WHERE plugin_name = ${pluginName}
      ORDER BY applied_at ASC
    `;
    return result || [];
  } catch (error) {
    return [];
  }
}

/**
 * Data migration options
 */
export interface DataMigrationOptions {
  /** Number of rows to process per batch (default: 1000) */
  batchSize?: number;
  /** Delay between batches in ms (default: 0) */
  delayMs?: number;
  /** Progress callback */
  onProgress?: (progress: DataMigrationProgress) => void;
  /** Abort signal */
  abortSignal?: AbortSignal;
}

/**
 * Data migration progress information
 */
export interface DataMigrationProgress {
  /** Total rows processed so far */
  processed: number;
  /** Total rows to process (if known) */
  total: number | null;
  /** Progress percentage (0-100) */
  percentage: number | null;
  /** Current batch number */
  batchNumber: number;
  /** Rows in current batch */
  batchSize: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining: number | null;
  /** Time elapsed in ms */
  elapsed: number;
}

/**
 * Data migration result
 */
export interface DataMigrationResult {
  /** Total rows affected */
  rowsAffected: number;
  /** Number of batches executed */
  batchesExecuted: number;
  /** Total duration in ms */
  duration: number;
  /** Whether completed successfully */
  success: boolean;
  /** Error if failed */
  error?: Error;
  /** Whether aborted */
  aborted: boolean;
}

/**
 * Execute a data migration with batching
 * 
 * Use for large UPDATE/INSERT operations that need to be broken into
 * smaller batches to avoid locking and memory issues.
 * 
 * @example
 * ```typescript
 * const result = await executeDataMigration(
 *   sql,
 *   {
 *     query: 'UPDATE users SET email_normalized = LOWER(email) WHERE email_normalized IS NULL',
 *     countQuery: 'SELECT COUNT(*) FROM users WHERE email_normalized IS NULL',
 *     batchQuery: 'UPDATE users SET email_normalized = LOWER(email) WHERE email_normalized IS NULL AND id IN (SELECT id FROM users WHERE email_normalized IS NULL LIMIT $1)',
 *   },
 *   { batchSize: 1000, onProgress: console.log }
 * );
 * ```
 */
export async function executeDataMigration(
  sql: any,
  migration: {
    /** Query to count total rows (optional but recommended) */
    countQuery?: string;
    /** Query to process one batch, should include LIMIT clause or similar */
    batchQuery: string;
    /** Parameters for batch query (first param will be batch size) */
    batchParams?: any[];
  },
  options: DataMigrationOptions = {}
): Promise<DataMigrationResult> {
  const batchSize = options.batchSize ?? 1000;
  const delayMs = options.delayMs ?? 0;
  const startTime = Date.now();

  let total: number | null = null;
  let processed = 0;
  let batchNumber = 0;
  let aborted = false;

  // Get total count if query provided
  if (migration.countQuery) {
    try {
      const countResult = await sql.unsafe(migration.countQuery);
      total = parseInt(countResult[0]?.count || "0", 10);
    } catch {
      // Ignore count errors
    }
  }

  try {
    // Process batches
    while (true) {
      // Check abort signal
      if (options.abortSignal?.aborted) {
        aborted = true;
        break;
      }

      batchNumber++;
      const batchParams = [batchSize, ...(migration.batchParams || [])];

      // Execute batch
      const result = await sql.unsafe(migration.batchQuery, batchParams);
      const rowsInBatch = result.count ?? result.length ?? 0;

      if (rowsInBatch === 0) {
        break; // No more rows to process
      }

      processed += rowsInBatch;

      // Report progress
      if (options.onProgress) {
        const elapsed = Date.now() - startTime;
        const rowsPerMs = processed / elapsed;
        let estimatedRemaining: number | null = null;
        let percentage: number | null = null;

        if (total !== null && total > 0) {
          percentage = Math.round((processed / total) * 100);
          const remaining = total - processed;
          estimatedRemaining = remaining > 0 ? Math.round(remaining / rowsPerMs) : 0;
        }

        options.onProgress({
          processed,
          total,
          percentage,
          batchNumber,
          batchSize: rowsInBatch,
          estimatedTimeRemaining: estimatedRemaining,
          elapsed,
        });
      }

      // If we got fewer rows than batch size, we're done
      if (rowsInBatch < batchSize) {
        break;
      }

      // Delay between batches if configured
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return {
      rowsAffected: processed,
      batchesExecuted: batchNumber,
      duration: Date.now() - startTime,
      success: !aborted,
      aborted,
    };
  } catch (error) {
    return {
      rowsAffected: processed,
      batchesExecuted: batchNumber,
      duration: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      aborted,
    };
  }
}

/**
 * Format data migration progress for display
 */
export function formatDataMigrationProgress(progress: DataMigrationProgress): string {
  const parts: string[] = [];

  if (progress.percentage !== null) {
    parts.push(`${progress.percentage}%`);
  }

  parts.push(`${progress.processed.toLocaleString()} rows`);

  if (progress.total !== null) {
    parts.push(`of ${progress.total.toLocaleString()}`);
  }

  parts.push(`(batch ${progress.batchNumber})`);

  if (progress.estimatedTimeRemaining !== null && progress.estimatedTimeRemaining > 0) {
    const mins = Math.round(progress.estimatedTimeRemaining / 60000);
    const secs = Math.round((progress.estimatedTimeRemaining % 60000) / 1000);
    if (mins > 0) {
      parts.push(`~${mins}m ${secs}s remaining`);
    } else {
      parts.push(`~${secs}s remaining`);
    }
  }

  return parts.join(" ");
}
