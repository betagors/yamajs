import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { success, error, info, warning, printBox, printTable, formatDuration, createSpinner } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import type { DatabaseConfig, MigrationStepUnion } from "@betagors/yama-core";
import { resolveEnvVars, loadEnvFile } from "@betagors/yama-core";
import { getDatabasePluginAndConfig } from "../utils/db-plugin.ts";

interface SchemaRollbackOptions {
  steps?: number | string;
  to?: string;
  dryRun?: boolean;
  config?: string;
  env?: string;
  force?: boolean;
  skipConfirm?: boolean;
}

/**
 * Parse migration YAML file
 */
function parseMigrationYAML(content: string): { steps: MigrationStepUnion[] } | null {
  try {
    const parsed = yaml.load(content) as any;
    if (parsed && Array.isArray(parsed.steps)) {
      return { steps: parsed.steps };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract "Down" section from SQL file
 */
function extractDownSQL(sqlContent: string): string | null {
  const lines = sqlContent.split("\n");
  let inDownSection = false;
  const downLines: string[] = [];

  for (const line of lines) {
    if (/^--\s*Down\s*$/i.test(line.trim())) {
      inDownSection = true;
      continue;
    }
    if (/^--\s*Up\s*$/i.test(line.trim())) {
      inDownSection = false;
      continue;
    }
    if (inDownSection) {
      downLines.push(line);
    }
  }

  const downSQL = downLines.join("\n").trim();
  return downSQL || null;
}

/**
 * Generate rollback SQL from migration steps (reverse operations)
 */
function generateRollbackSQLFromSteps(steps: MigrationStepUnion[]): string {
  const statements: string[] = [];
  const reversedSteps = [...steps].reverse();

  for (const step of reversedSteps) {
    switch (step.type) {
      case "add_table":
        statements.push(`DROP TABLE IF EXISTS ${step.table} CASCADE;`);
        break;
      case "add_column":
        statements.push(`ALTER TABLE ${step.table} DROP COLUMN IF EXISTS ${step.column.name} CASCADE;`);
        break;
      case "add_index":
        statements.push(`DROP INDEX IF EXISTS ${step.index.name};`);
        break;
      case "add_foreign_key":
        statements.push(`ALTER TABLE ${step.table} DROP CONSTRAINT IF EXISTS ${step.foreignKey.name};`);
        break;
      case "drop_table":
      case "drop_column":
      case "drop_index":
      case "drop_foreign_key":
      case "modify_column":
        statements.push(`-- Cannot automatically rollback ${step.type} for ${step.table}`);
        break;
    }
  }

  return statements.join("\n");
}

export async function schemaRollbackCommand(options: SchemaRollbackOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
      database?: DatabaseConfig;
    };
    config = resolveEnvVars(config) as typeof config;
    const configDir = getConfigDir(configPath);

    // Safety check for production
    const isProduction = environment === "production" || environment === "prod";
    if (isProduction && !options.force && !options.dryRun) {
      warning("⚠️  WARNING: Rolling back in PRODUCTION!");
      if (!options.skipConfirm) {
        const confirmed = await confirm("Continue?", false);
        if (!confirmed) {
          info("Cancelled.");
          return;
        }
      }
    }

    if (!options.steps && !options.to) {
      options.steps = 1;
    }

    if (options.steps && options.to) {
      error("Cannot use both --steps and --to");
      process.exit(1);
    }

    const migrationsDir = join(configDir, "migrations");
    if (!existsSync(migrationsDir)) {
      info("No migrations directory.");
      return;
    }

    const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
    await dbPlugin.client.initDatabase(dbConfig);
    const sql = dbPlugin.client.getSQL();

    await sql.unsafe(dbPlugin.migrations.getMigrationTableSQL());

    let appliedMigrations: Array<{ id: number; name: string; applied_at: Date }> = [];
    try {
      const result = await sql.unsafe(`
        SELECT id, name, applied_at FROM _yama_migrations ORDER BY applied_at DESC
      `);
      appliedMigrations = result as any;
    } catch {
      error("Failed to query migrations");
      await dbPlugin.client.closeDatabase();
      process.exit(1);
    }

    if (appliedMigrations.length === 0) {
      info("No migrations to rollback.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    let migrationsToRollback: typeof appliedMigrations;
    
    if (options.steps) {
      const steps = typeof options.steps === "string" ? parseInt(options.steps, 10) : options.steps;
      if (isNaN(steps) || steps < 1) {
        error("Steps must be positive");
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
      migrationsToRollback = appliedMigrations.slice(0, steps);
    } else if (options.to) {
      const targetIndex = appliedMigrations.findIndex((m) => m.name === options.to);
      if (targetIndex === -1) {
        error(`Migration "${options.to}" not found`);
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
      migrationsToRollback = appliedMigrations.slice(0, targetIndex + 1);
    } else {
      migrationsToRollback = appliedMigrations.slice(0, 1);
    }

    if (migrationsToRollback.length === 0) {
      info("Nothing to rollback.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Show plan
    console.log("\nRollback Plan:");
    const table: string[][] = [["#", "Migration", "Applied At"]];
    migrationsToRollback.forEach((m, i) => {
      table.push([`${i + 1}`, m.name, new Date(m.applied_at).toLocaleString()]);
    });
    printTable(table);

    if (options.dryRun) {
      info("Dry run - no changes.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    if (!options.skipConfirm && !options.force) {
      const confirmed = await confirm(`Rollback ${migrationsToRollback.length} migration(s)?`, false);
      if (!confirmed) {
        info("Cancelled.");
        await dbPlugin.client.closeDatabase();
        return;
      }
    }

    let rolledBackCount = 0;
    const startTime = Date.now();

    for (const migration of migrationsToRollback) {
      const spinner = createSpinner(`Rolling back ${migration.name}...`);

      try {
        let rollbackSQL: string | null = null;

        // Try SQL file first
        const sqlFile = migration.name.replace(".yaml", ".sql");
        const sqlPath = join(migrationsDir, sqlFile);
        
        if (existsSync(sqlPath)) {
          rollbackSQL = extractDownSQL(readFileSync(sqlPath, "utf-8"));
        }

        // Try YAML if no down SQL
        if (!rollbackSQL) {
          const yamlPath = join(migrationsDir, migration.name);
          if (existsSync(yamlPath)) {
            const parsed = parseMigrationYAML(readFileSync(yamlPath, "utf-8"));
            if (parsed) {
              rollbackSQL = generateRollbackSQLFromSteps(parsed.steps);
            }
          }
        }

        if (!rollbackSQL?.trim()) {
          spinner.warn(`Skipped ${migration.name} (no rollback SQL)`);
          continue;
        }

        await sql.begin(async (tx: any) => {
          if (rollbackSQL!.trim()) {
            await tx.unsafe(rollbackSQL);
          }
          await tx.unsafe(`DELETE FROM _yama_migrations WHERE name = '${migration.name.replace(/'/g, "''")}'`);
        });

        spinner.succeed(`Rolled back ${migration.name}`);
        rolledBackCount++;
      } catch (err) {
        spinner.fail(`Failed: ${migration.name}`);
        error(`${err instanceof Error ? err.message : String(err)}`);
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
    }

    if (rolledBackCount > 0) {
      const duration = Date.now() - startTime;
      success(`Rolled back ${rolledBackCount} migration(s) in ${formatDuration(duration)}`);
    } else {
      info("No migrations rolled back.");
    }

    await dbPlugin.client.closeDatabase();
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
