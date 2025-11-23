import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@yama/core";
import type { DatabaseConfig } from "@yama/core";
import {
  deserializeMigration,
  validateMigration,
  entitiesToModel,
  getCurrentModelHashFromDB,
} from "@yama/core";
import {
  success,
  error,
  info,
  warning,
  pending,
  printBox,
  createSpinner,
  formatDuration,
  printHints,
} from "../utils/cli-utils.ts";
import { printError } from "../utils/error-handler.ts";
import { confirmMigration, hasDestructiveOperation } from "../utils/interactive.ts";
import { TrashManager } from "../utils/trash-manager.ts";
import { getDatabasePlugin } from "../utils/db-plugin.ts";

interface SchemaApplyOptions {
  config?: string;
  env?: string;
  noApply?: boolean;
  interactive?: boolean;
  allowDestructive?: boolean;
}

export async function schemaApplyCommand(options: SchemaApplyOptions): Promise<void> {
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

    if (!config.database) {
      error("No database configuration found in yama.yaml");
      process.exit(1);
    }

    const migrationsDir = join(configDir, "migrations");

    if (!existsSync(migrationsDir)) {
      info("No migrations directory found. Run 'yama schema:generate' first.");
      return;
    }

    // Get all migration YAML files
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".yaml"))
      .sort();

    if (migrationFiles.length === 0) {
      info("No migration files found.");
      return;
    }

    // Initialize database
    const dbPlugin = await getDatabasePlugin();
    dbPlugin.client.initDatabase(config.database);
    const sql = dbPlugin.client.getSQL();

    // Create migration tables
    await sql.unsafe(dbPlugin.migrations.getMigrationTableSQL());
    await sql.unsafe(dbPlugin.migrations.getMigrationRunsTableSQL());

    // Get applied migrations
    const appliedMigrations = await sql`
      SELECT name, to_model_hash FROM _yama_migrations ORDER BY applied_at
    `;
    const appliedNames = new Set(
      (appliedMigrations as unknown as Array<{ name: string }>).map((m) => m.name)
    );

    // Get current model hash
    const currentHash = await getCurrentModelHashFromDB(async (query) => {
      return (await sql.unsafe(query)) as Array<{ to_model_hash: string }>;
    });

    // Load target model for validation
    const configWithEntities = readYamaConfig(configPath) as { entities?: any };
    const targetModel = configWithEntities.entities
      ? entitiesToModel(configWithEntities.entities)
      : null;

    // Process pending migrations
    let appliedCount = 0;
    const startTime = Date.now();
    let lastAppliedHash: string | null = currentHash;

    for (const file of migrationFiles) {
      if (appliedNames.has(file)) {
        info(`Skipping ${file} (already applied)`);
        // Update lastAppliedHash from database for already applied migrations
        const appliedMigration = (appliedMigrations as unknown as Array<{ name: string; to_model_hash: string }>).find(
          (m) => m.name === file
        );
        if (appliedMigration?.to_model_hash) {
          lastAppliedHash = appliedMigration.to_model_hash;
        }
        continue;
      }

      const filePath = join(migrationsDir, file);
      const yamlContent = readFileSync(filePath, "utf-8");
      const migration = deserializeMigration(yamlContent);

      // Auto-fix empty from_model.hash by inferring from previous migration
      if (!migration.from_model.hash || migration.from_model.hash === "") {
        // First, try to use lastAppliedHash (database state) - most reliable
        if (lastAppliedHash) {
          migration.from_model.hash = lastAppliedHash;
          warning(
            `Migration ${file} has empty from_model.hash. Auto-fixing from database state (${lastAppliedHash.substring(0, 8)}...)`
          );
        } else {
          // If no database state, try to get from previous migration file
          const currentIndex = migrationFiles.indexOf(file);
          if (currentIndex > 0) {
            const prevFile = migrationFiles[currentIndex - 1];
            const prevFilePath = join(migrationsDir, prevFile);
            if (existsSync(prevFilePath)) {
              try {
                const prevYamlContent = readFileSync(prevFilePath, "utf-8");
                const prevMigration = deserializeMigration(prevYamlContent);
                if (prevMigration.to_model.hash) {
                  migration.from_model.hash = prevMigration.to_model.hash;
                  warning(
                    `Migration ${file} has empty from_model.hash. Auto-fixing from previous migration ${prevFile} (${prevMigration.to_model.hash.substring(0, 8)}...)`
                  );
                }
              } catch (err) {
                // Failed to read previous migration, continue with other checks
              }
            }
          }
        }
      }

      // Validate migration hash
      // Empty hash means first migration (empty database)
      if (migration.from_model.hash && lastAppliedHash && migration.from_model.hash !== lastAppliedHash) {
        error(
          `Migration ${file} from_model.hash (${migration.from_model.hash.substring(0, 8)}...) does not match current database state (${lastAppliedHash.substring(0, 8)}...)`
        );
        printError(
          new Error("Migration hash mismatch"),
          { migration: file }
        );
        dbPlugin.client.closeDatabase();
        process.exit(1);
      }
      
      // If migration has empty from_model.hash, it's the first migration
      // Allow it if lastAppliedHash is also empty/null
      if (!migration.from_model.hash && lastAppliedHash) {
        error(
          `Migration ${file} is marked as first migration (empty from_model.hash) but database already has migrations applied`
        );
        dbPlugin.client.closeDatabase();
        process.exit(1);
      }

      // Check for destructive operations
      const hasDestructive = migration.steps.some(hasDestructiveOperation);
      
      // Create data snapshots before destructive operations
      if (hasDestructive) {
        const destructiveSteps = migration.steps.filter(hasDestructiveOperation);
        for (const step of destructiveSteps) {
          if (step.type === "drop_table" || step.type === "drop_column" || step.type === "modify_column") {
            try {
              info(`Creating snapshot for ${step.table}...`);
              const snapshot = await dbPlugin.snapshots.create(
                step.table,
                config.database!,
                `${step.table}_before_${file.replace(".yaml", "")}`,
                true // Use existing connection, don't close it
              );
              info(`Snapshot created: ${snapshot.snapshotTable} (${snapshot.rowCount} rows)`);
            } catch (err) {
              warning(`Failed to create snapshot for ${step.table}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
      
      if (hasDestructive && !options.allowDestructive) {
        if (options.interactive) {
          const confirmed = await confirmMigration(
            file,
            migration.steps,
            hasDestructive
          );
          if (!confirmed) {
            info(`Skipping ${file} (user cancelled)`);
            continue;
          }
        } else {
          error(
            `Migration ${file} contains destructive operations. Use --allow-destructive to apply.`
          );
          dbPlugin.client.closeDatabase();
          process.exit(1);
        }
      }

      if (options.noApply) {
        info(`Would apply: ${file}`);
        continue;
      }

      // Load SQL file
      const sqlFile = file.replace(".yaml", ".sql");
      const sqlPath = join(migrationsDir, sqlFile);
      let sqlContent: string;

      if (existsSync(sqlPath)) {
        sqlContent = readFileSync(sqlPath, "utf-8");
      } else {
        // Generate SQL from steps if file doesn't exist
        sqlContent = dbPlugin.migrations.generateFromSteps(migration.steps);
      }

      // Compute checksum
      const checksum = dbPlugin.migrations.computeChecksum(yamlContent, sqlContent);

      const spinner = createSpinner(`Applying ${file}...`);

      try {
        const runStart = Date.now();

        // Start migration run
        const runResult = await sql`
          INSERT INTO _yama_migration_runs (migration_id, status, started_at)
          VALUES (NULL, 'running', NOW())
          RETURNING id
        `;
        const runId = runResult[0]?.id;

        // Execute migration in transaction
        await sql.begin(async (tx: any) => {
          await tx.unsafe(sqlContent);

          // Record migration
          await tx`
            INSERT INTO _yama_migrations (
              name, type, from_model_hash, to_model_hash, checksum, description
            ) VALUES (
              ${file},
              ${migration.type},
              ${migration.from_model.hash},
              ${migration.to_model.hash},
              ${checksum},
              ${migration.metadata.description || null}
            )
          `;

          // Update run status
          if (runId) {
            await tx`
              UPDATE _yama_migration_runs
              SET status = 'completed', finished_at = NOW()
              WHERE id = ${runId}
            `;
          }
        });

        const duration = Date.now() - runStart;
        spinner.succeed(`Applied ${file} (${formatDuration(duration)})`);
        appliedCount++;
        // Update lastAppliedHash for next migration
        lastAppliedHash = migration.to_model.hash;
      } catch (err) {
        spinner.fail(`Failed to apply ${file}`);

        // Update run status
        try {
          await sql`
            UPDATE _yama_migration_runs
            SET status = 'failed', finished_at = NOW(), error_message = ${err instanceof Error ? err.message : String(err)}
            WHERE id = (SELECT id FROM _yama_migration_runs ORDER BY started_at DESC LIMIT 1)
          `;
        } catch {
          // Ignore update errors
        }

        printError(err, { migration: file });
        dbPlugin.client.closeDatabase();
        process.exit(1);
      }
    }

    if (appliedCount === 0) {
      info("All migrations are already applied.");
    } else {
      const totalDuration = Date.now() - startTime;
      printBox(
        `Applied ${appliedCount} migration(s)\nDuration: ${formatDuration(totalDuration)}`,
        { borderColor: "green" }
      );
    }

    dbPlugin.client.closeDatabase();

    if (appliedCount > 0) {
      printHints([
        "Run 'yama schema:check' to verify schema is in sync",
        "Run 'yama schema:status' to see migration status",
      ]);
    }
  } catch (err) {
    error(`Failed to apply migrations: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

