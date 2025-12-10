import { getFileSystem, getPathModule } from "../platform/fs.js";
import { getEnvProvider } from "../platform/env.js";
import { sha256Hex } from "../platform/hash.js";
import semver from "semver";
import type { YamaPlugin, PluginManifest, PluginMigrationDefinition } from "./base.js";

const fs = () => getFileSystem();
const path = () => getPathModule();

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
export async function getPluginPackageDir(
  packageName: string,
  projectDir?: string
): Promise<string> {
  const fs = getFileSystem();
  const path = getPathModule();
  try {
    const { createRequire } = await import("module");
    
    const projectRoot = projectDir || getEnvProvider().cwd();
    let packagePath: string;
    
    try {
      const projectRequire = createRequire(path.resolve(projectRoot, "package.json"));
      packagePath = projectRequire.resolve(packageName);
    } catch {
      const require = createRequire(import.meta.url);
      packagePath = require.resolve(packageName);
    }
    
    // Get the directory containing the resolved file
    // If packagePath points to a file, get its directory
    // If it points to a directory, use it directly
    let packageDir: string;
    if (fs.existsSync(packagePath) && !fs.existsSync(path.join(packagePath, "package.json"))) {
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
      if (fs.existsSync(packageJsonPath)) {
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
    const filePath = path.join(pluginDir, script);
    if (!fs().existsSync(filePath)) {
      throw new Error(
        `Migration file not found: ${filePath}`
      );
    }
    return fs().readFileSync(filePath, "utf-8");
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

