import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { success, error, info, warning, printBox, printTable, formatDuration, createSpinner } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import type { DatabaseConfig } from "@betagors/yama-core";
import { deserializeMigration, type MigrationStepUnion, resolveEnvVars, loadEnvFile } from "@betagors/yama-core";
import { getDatabasePlugin } from "../utils/db-plugin.ts";

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
 * Extract "Down" section from SQL file
 */
function extractDownSQL(sqlContent: string): string | null {
  const lines = sqlContent.split("\n");
  let inDownSection = false;
  const downLines: string[] = [];

  for (const line of lines) {
    // Check for "-- Down" marker (case insensitive, with optional whitespace)
    if (/^--\s*Down\s*$/i.test(line.trim())) {
      inDownSection = true;
      continue;
    }
    
    // Check for "-- Up" marker (if we encounter this after Down, stop)
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
function generateRollbackSQLFromSteps(steps: MigrationStepUnion[], dbPlugin: any): string {
  const statements: string[] = [];
  
  // Reverse the steps array to rollback in reverse order
  const reversedSteps = [...steps].reverse();

  for (const step of reversedSteps) {
    switch (step.type) {
      case "add_table":
        statements.push(`-- Rollback: Drop table ${step.table}`);
        statements.push(`DROP TABLE IF EXISTS ${step.table} CASCADE;`);
        break;

      case "drop_table":
        // To rollback a drop_table, we'd need the original table definition
        // This is complex, so we'll just warn
        statements.push(`-- Rollback: Cannot automatically recreate dropped table ${step.table}`);
        statements.push(`-- Manual intervention required`);
        break;

      case "add_column":
        statements.push(`-- Rollback: Drop column ${step.table}.${step.column.name}`);
        statements.push(`ALTER TABLE ${step.table} DROP COLUMN IF EXISTS ${step.column.name} CASCADE;`);
        break;

      case "drop_column":
        // To rollback a drop_column, we'd need the original column definition
        statements.push(`-- Rollback: Cannot automatically recreate dropped column ${step.table}.${step.column}`);
        statements.push(`-- Manual intervention required`);
        break;

      case "modify_column":
        // Rollback column modifications - this is complex and may not be fully reversible
        statements.push(`-- Rollback: Column modification for ${step.table}.${step.column}`);
        statements.push(`-- Note: Some modifications may not be fully reversible`);
        // We'd need the original column state to properly rollback
        break;

      case "add_index":
        statements.push(`-- Rollback: Drop index ${step.index.name}`);
        statements.push(`DROP INDEX IF EXISTS ${step.index.name};`);
        break;

      case "drop_index":
        // To rollback a drop_index, we'd need the original index definition
        statements.push(`-- Rollback: Cannot automatically recreate dropped index ${step.index}`);
        statements.push(`-- Manual intervention required`);
        break;

      case "add_foreign_key":
        statements.push(`-- Rollback: Drop foreign key ${step.foreignKey.name}`);
        statements.push(`ALTER TABLE ${step.table} DROP CONSTRAINT IF EXISTS ${step.foreignKey.name};`);
        break;

      case "drop_foreign_key":
        // To rollback a drop_foreign_key, we'd need the original FK definition
        statements.push(`-- Rollback: Cannot automatically recreate dropped foreign key ${step.foreignKey}`);
        statements.push(`-- Manual intervention required`);
        break;
    }
  }

  return statements.join("\n");
}

export async function schemaRollbackCommand(options: SchemaRollbackOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as { database?: DatabaseConfig };
    config = resolveEnvVars(config) as { database?: DatabaseConfig };
    const configDir = getConfigDir(configPath);

    // Safety check: production environment warning
    const isProduction = environment === "production" || environment === "prod";
    if (isProduction && !options.force && !options.dryRun) {
      warning("⚠️  WARNING: You are about to rollback migrations in PRODUCTION!");
      warning("   This operation can cause data loss and service disruption.");
      warning("   Consider taking a database backup first.");
      console.log();
      
      if (!options.skipConfirm) {
        const confirmed = await confirm(
          "Are you absolutely sure you want to continue?",
          false
        );
        if (!confirmed) {
          info("Rollback cancelled.");
          return;
        }
      }
    }

    // Validate options
    if (!options.steps && !options.to) {
      // Default to 1 step if nothing specified
      options.steps = 1;
    }

    if (options.steps && options.to) {
      error("Cannot specify both --steps and --to. Use one or the other.");
      process.exit(1);
    }

    if (!config.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    const migrationsDir = join(configDir, "migrations");

    if (!existsSync(migrationsDir)) {
      info("No migrations directory found.");
      return;
    }

    // Initialize database
    const dbPlugin = await getDatabasePlugin();
    await dbPlugin.client.initDatabase(config.database);
    const sql = dbPlugin.client.getSQL();

    // Create migration tables if they don't exist
    await sql.unsafe(dbPlugin.migrations.getMigrationTableSQL());
    await sql.unsafe(dbPlugin.migrations.getMigrationRunsTableSQL());

    // Get applied migrations (most recent first)
    let appliedMigrations: Array<{
      id: number;
      name: string;
      applied_at: Date;
      to_model_hash: string;
    }> = [];

    try {
      const result = await sql.unsafe(`
        SELECT id, name, applied_at, to_model_hash
        FROM _yama_migrations
        ORDER BY applied_at DESC
      `);
      appliedMigrations = result as unknown as typeof appliedMigrations;
    } catch (err) {
      error("Failed to query migration history");
      await dbPlugin.client.closeDatabase();
      process.exit(1);
    }

    if (appliedMigrations.length === 0) {
      info("No migrations have been applied. Nothing to rollback.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Determine which migrations to rollback
    let migrationsToRollback: typeof appliedMigrations;
    
    if (options.steps) {
      const steps = typeof options.steps === "string" ? parseInt(options.steps, 10) : options.steps;
      if (isNaN(steps) || steps < 1) {
        error("Steps must be a positive number");
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
      migrationsToRollback = appliedMigrations.slice(0, steps);
    } else if (options.to) {
      // Find the migration with the specified name
      const targetIndex = appliedMigrations.findIndex((m) => m.name === options.to);
      if (targetIndex === -1) {
        error(`Migration "${options.to}" not found in applied migrations`);
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
      // Rollback everything after (and including) the target migration
      migrationsToRollback = appliedMigrations.slice(0, targetIndex + 1);
    } else {
      migrationsToRollback = appliedMigrations.slice(0, 1);
    }

    if (migrationsToRollback.length === 0) {
      info("No migrations to rollback.");
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Show rollback plan
    console.log("\n" + "=".repeat(60));
    printBox(
      `Rollback Plan\n\n` +
      `Migrations to Rollback: ${migrationsToRollback.length}\n` +
      `Environment: ${environment}`,
      isProduction ? { borderColor: "red" } : undefined
    );

    const rollbackTable: string[][] = [
      ["#", "Migration", "Applied At"],
    ];
    
    migrationsToRollback.forEach((m, index) => {
      rollbackTable.push([
        `${index + 1}`,
        m.name,
        new Date(m.applied_at).toLocaleString(),
      ]);
    });

    printTable(rollbackTable);

    // Check for missing rollback SQL
    const missingRollback: string[] = [];
    for (const migration of migrationsToRollback) {
      const sqlFile = migration.name.replace(".yaml", ".sql");
      const sqlPath = join(migrationsDir, sqlFile);
      
      if (existsSync(sqlPath)) {
        const sqlContent = readFileSync(sqlPath, "utf-8");
        const downSQL = extractDownSQL(sqlContent);
        if (!downSQL) {
          missingRollback.push(migration.name);
        }
      } else {
        // Check if we can generate from YAML
        const yamlPath = join(migrationsDir, migration.name);
        if (existsSync(yamlPath)) {
          try {
            const yamlContent = readFileSync(yamlPath, "utf-8");
            const migrationData = deserializeMigration(yamlContent);
            // Check if steps can be reversed
            const hasIrreversibleSteps = migrationData.steps.some(
              (s) => s.type === "drop_table" || s.type === "drop_column" || s.type === "drop_index" || s.type === "drop_foreign_key"
            );
            if (hasIrreversibleSteps) {
              missingRollback.push(migration.name);
            }
          } catch {
            missingRollback.push(migration.name);
          }
        } else {
          missingRollback.push(migration.name);
        }
      }
    }

    if (missingRollback.length > 0) {
      warning("\n⚠️  Warning: The following migrations may not have complete rollback support:");
      missingRollback.forEach((name) => warning(`   - ${name}`));
      warning("   Some operations (like DROP TABLE) cannot be automatically reversed.");
      
      if (!options.force && !options.dryRun) {
        const confirmed = await confirm(
          "Continue anyway? (This may leave your database in an inconsistent state)",
          false
        );
        if (!confirmed) {
          info("Rollback cancelled.");
          await dbPlugin.client.closeDatabase();
          return;
        }
      }
    }

    if (options.dryRun) {
      info("\n🔍 Dry run mode - no changes will be made");
      await dbPlugin.client.closeDatabase();
      return;
    }

    // Confirm rollback
    if (!options.skipConfirm && !options.force) {
      console.log("\n⚠️  Warning: Rollback will undo database changes!");
      const confirmed = await confirm(
        `Rollback ${migrationsToRollback.length} migration(s)?`,
        false
      );
      if (!confirmed) {
        info("Rollback cancelled.");
        await dbPlugin.client.closeDatabase();
        return;
      }
    }

    // Execute rollbacks in reverse order (newest first)
    let rolledBackCount = 0;
    const startTime = Date.now();

    for (const migration of migrationsToRollback) {
      const spinner = createSpinner(`Rolling back ${migration.name}...`);

      try {
        const rollbackStart = Date.now();

        // Try to get rollback SQL
        let rollbackSQL: string | null = null;

        // First, try to extract from SQL file
        const sqlFile = migration.name.replace(".yaml", ".sql");
        const sqlPath = join(migrationsDir, sqlFile);
        
        if (existsSync(sqlPath)) {
          const sqlContent = readFileSync(sqlPath, "utf-8");
          rollbackSQL = extractDownSQL(sqlContent);
        }

        // If no down SQL found, try to generate from YAML steps
        if (!rollbackSQL) {
          const yamlPath = join(migrationsDir, migration.name);
          if (existsSync(yamlPath)) {
            try {
              const yamlContent = readFileSync(yamlPath, "utf-8");
              const migrationData = deserializeMigration(yamlContent);
              rollbackSQL = generateRollbackSQLFromSteps(migrationData.steps, dbPlugin);
            } catch (err) {
              error(`Failed to parse migration file: ${migration.name}`);
              spinner.fail(`Failed to rollback ${migration.name}`);
              continue;
            }
          }
        }

        if (!rollbackSQL || rollbackSQL.trim() === "") {
          warning(`No rollback SQL found for ${migration.name}. Skipping.`);
          spinner.warn(`Skipped ${migration.name} (no rollback SQL)`);
          continue;
        }

        // Execute rollback in transaction
        await sql.begin(async (tx: any) => {
          // Execute rollback SQL
          if (rollbackSQL.trim()) {
            await tx.unsafe(rollbackSQL);
          }

          // Remove migration record
          await tx.unsafe(`
            DELETE FROM _yama_migrations
            WHERE name = '${migration.name.replace(/'/g, "''")}'
          `);
        });

        const duration = Date.now() - rollbackStart;
        spinner.succeed(`Rolled back ${migration.name} (${formatDuration(duration)})`);
        rolledBackCount++;
      } catch (err) {
        spinner.fail(`Failed to rollback ${migration.name}`);
        const errorMsg = err instanceof Error ? err.message : String(err);
        error(`Rollback error: ${errorMsg}`);
        
        console.log("\n💡 Recovery Tips:");
        console.log("   1. Check the error message above for details");
        console.log("   2. Verify your database connection");
        console.log("   3. Review the rollback SQL for syntax errors");
        console.log("   4. Check if the database is in a consistent state");
        console.log("   5. Consider restoring from a backup if needed");
        
        await dbPlugin.client.closeDatabase();
        process.exit(1);
      }
    }

    if (rolledBackCount === 0) {
      info("No migrations were rolled back.");
    } else {
      const totalDuration = Date.now() - startTime;
      printBox(
        `Rolled back ${rolledBackCount} migration(s)\nDuration: ${formatDuration(totalDuration)}`,
        { borderColor: "yellow" }
      );
    }

    await dbPlugin.client.closeDatabase();
  } catch (err) {
    error(`Failed to rollback migrations: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

