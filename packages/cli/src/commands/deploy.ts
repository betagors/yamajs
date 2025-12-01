import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import {
  getCurrentSnapshot,
  findPath,
  loadSnapshot,
  assessTransition,
  analyzeImpact,
  getSafetySummary,
  SafetyLevel,
  updateState,
  loadEnvFile,
  resolveEnvVars,
  entitiesToModel,
  createSnapshot,
  saveSnapshot,
  snapshotExists,
  createTransition,
  saveTransition,
  computeDiff,
  diffToSteps,
} from "@betagors/yama-core";
import { info, error, success, warning, dim, fmt, createSpinner, formatDuration } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";
import { getDatabasePlugin, getDatabasePluginAndConfig } from "../utils/db-plugin.ts";

/**
 * Split SQL into statements
 */
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    current += (current ? '\n' : '') + line;
    if (trimmed.endsWith(';')) {
      if (current.trim()) statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

interface DeployOptions {
  config?: string;
  env: string;
  plan?: boolean;
  dryRun?: boolean;
  autoRollback?: boolean;
}

export async function deployCommand(options: DeployOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    loadEnvFile(configPath, options.env);
    const config = resolveEnvVars(readYamaConfig(configPath)) as any;
    const configDir = getConfigDir(configPath);

    if (!config.schemas || Object.keys(config.schemas).length === 0) {
      error("No schemas defined in config.");
      process.exit(1);
    }

    // Get current snapshot
    const currentSnapshot = getCurrentSnapshot(configDir, options.env);

    // Get target model from current config
    const entities = extractEntitiesFromSchemas(config.schemas);
    const normalizedEntities = normalizeEntities(entities);
    const targetModel = entitiesToModel(normalizedEntities);
    const targetHash = targetModel.hash;

    // Already up to date?
    if (currentSnapshot === targetHash) {
      success(`${options.env} is up to date.`);
      return;
    }

    // Ensure target snapshot exists
    if (!snapshotExists(configDir, targetHash)) {
      const snapshot = createSnapshot(normalizedEntities, {
        createdAt: new Date().toISOString(),
        createdBy: process.env.USER || "deploy",
        description: `Deploy to ${options.env}`,
      }, currentSnapshot || undefined);
      saveSnapshot(configDir, snapshot);
    }

    // Find path or create direct transition
    let transitions: any[] = [];
    
    if (currentSnapshot) {
      const path = findPath(configDir, currentSnapshot, targetHash);
      if (path && path.transitions.length > 0) {
        transitions = path.transitions;
      }
    }

    // If no path found, we need to create a direct transition
    if (transitions.length === 0) {
      // Connect to DB to get current schema
      const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
      await dbPlugin.client.initDatabase(dbConfig);
      const sql = dbPlugin.client.getSQL();

      // Read current DB model
      const fromModel = await readCurrentModelFromDB(sql);
      await dbPlugin.client.closeDatabase();

      // If DB is already at target, we're done
      if (fromModel.hash === targetHash) {
        updateState(configDir, options.env, targetHash);
        success(`${options.env} synced to ${targetHash.substring(0, 8)}.`);
        return;
      }

      // Create transition
      const diff = computeDiff(fromModel, targetModel);
      const steps = diffToSteps(diff, fromModel, targetModel);

      if (steps.length === 0) {
        updateState(configDir, options.env, targetHash);
        success(`${options.env} is up to date.`);
        return;
      }

      const transition = createTransition(fromModel.hash || "", targetHash, steps, {
        description: `Deploy to ${options.env}`,
        createdAt: new Date().toISOString(),
      });
      saveTransition(configDir, transition);
      transitions = [transition];
    }

    // Safety assessment
    let overallLevel = SafetyLevel.SAFE;
    for (const t of transitions) {
      const assessment = assessTransition(t);
      if (assessment.level === SafetyLevel.DANGEROUS) overallLevel = SafetyLevel.DANGEROUS;
      else if (assessment.level === SafetyLevel.REVIEW && overallLevel === SafetyLevel.SAFE) overallLevel = SafetyLevel.REVIEW;
    }

    const impact = analyzeImpact(transitions[0]);
    const summary = getSafetySummary(transitions[0]);

    // Show deployment plan
    console.log("");
    console.log(fmt.bold(`Deploy to ${options.env}`));
    console.log(dim("─".repeat(35)));
    console.log(`Current: ${currentSnapshot ? currentSnapshot.substring(0, 8) : dim("none")}`);
    console.log(`Target:  ${fmt.cyan(targetHash.substring(0, 8))}`);
    console.log(`Steps:   ${transitions.reduce((sum, t) => sum + t.steps.length, 0)}`);
    console.log(`Safety:  ${overallLevel === SafetyLevel.SAFE ? fmt.green(overallLevel) : overallLevel === SafetyLevel.REVIEW ? fmt.yellow(overallLevel) : fmt.red(overallLevel)}`);
    if (impact.downtime !== "none") console.log(`Downtime: ${impact.downtime}`);
    console.log("");

    if (options.plan) {
      // Show detailed steps
      for (const t of transitions) {
        for (const step of t.steps) {
          if (step.type === "add_table") console.log(fmt.green(`+ CREATE TABLE ${step.table}`));
          else if (step.type === "drop_table") console.log(fmt.red(`- DROP TABLE ${step.table}`));
          else if (step.type === "add_column") console.log(fmt.green(`+ ADD ${step.table}.${step.column.name}`));
          else if (step.type === "drop_column") console.log(fmt.red(`- DROP ${step.table}.${step.column}`));
          else if (step.type === "modify_column") console.log(fmt.yellow(`~ ALTER ${step.table}.${step.column}`));
          else if (step.type === "add_index") console.log(fmt.cyan(`+ INDEX ${step.index.name}`));
        }
      }
      return;
    }

    // Confirmation for non-safe deployments
    if (overallLevel !== SafetyLevel.SAFE && !options.dryRun) {
      warning("Review required for this deployment.");
      const confirmed = await confirm("Deploy?", false);
      if (!confirmed) {
        info("Cancelled.");
        return;
      }
    }

    if (options.dryRun) {
      success("Dry run complete. No changes made.");
      return;
    }

    // Execute deployment
    const spinner = createSpinner("Deploying...");
    const startTime = Date.now();

    const { plugin: dbPlugin, dbConfig } = await getDatabasePluginAndConfig(config, configPath);
    await dbPlugin.client.initDatabase(dbConfig);
    const sql = dbPlugin.client.getSQL();

    try {
      // Ensure migration table exists
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS _yama_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          type VARCHAR(50) DEFAULT 'schema',
          from_model_hash VARCHAR(64),
          to_model_hash VARCHAR(64),
          checksum VARCHAR(64),
          description TEXT,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      for (const transition of transitions) {
        const sqlContent = dbPlugin.migrations.generateFromSteps(transition.steps);
        
        if (sqlContent.trim()) {
          await sql.begin(async (tx: any) => {
            const statements = splitSQLStatements(sqlContent);
            for (const stmt of statements) {
              if (stmt.trim()) await tx.unsafe(stmt);
            }

            await tx.unsafe(`
              INSERT INTO _yama_migrations (name, type, from_model_hash, to_model_hash, description)
              VALUES ('transition_${transition.hash}', 'schema', '${transition.fromHash}', '${transition.toHash}', '${transition.metadata.description || ""}')
              ON CONFLICT (name) DO NOTHING
            `);
          });
        }
      }

      updateState(configDir, options.env, targetHash);

      const duration = Date.now() - startTime;
      spinner.succeed(`Deployed in ${formatDuration(duration)}`);
      console.log("");
      success(`${options.env} → ${targetHash.substring(0, 8)}`);

    } catch (err) {
      spinner.fail("Deploy failed");
      error(`${err instanceof Error ? err.message : String(err)}`);
      
      if (options.autoRollback && currentSnapshot) {
        warning("Auto-rollback triggered...");
        try {
          const { rollbackCommand } = await import("./rollback.ts");
          await rollbackCommand({ config: options.config, env: options.env, to: currentSnapshot });
        } catch (rollbackErr) {
          error(`Rollback failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`);
        }
      }
      process.exit(1);
    } finally {
      dbPlugin.client.closeDatabase();
    }
  } catch (err) {
    error(`Deploy failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Helper: Read DB model
async function readCurrentModelFromDB(sql: any): Promise<any> {
  const tablesResult = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '_yama_%' AND table_name NOT LIKE '%_snapshot_%'
  `;

  const tables = new Map();
  for (const row of tablesResult as Array<{ table_name: string }>) {
    const tableName = row.table_name;
    const columnsResult = await sql`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
    `;
    
    const columns = new Map();
    for (const col of columnsResult as any[]) {
      columns.set(col.column_name, {
        name: col.column_name,
        type: col.data_type.toUpperCase(),
        nullable: col.is_nullable === 'YES',
        primary: false,
      });
    }
    tables.set(tableName, { name: tableName, columns, indexes: [], foreignKeys: [] });
  }

  const { createHash } = await import("crypto");
  const normalized = JSON.stringify(Array.from(tables.entries()).map(([n, t]) => ({
    name: n, columns: Array.from((t as any).columns.entries()).map(([cn, c]) => ({ name: cn, type: (c as any).type })),
  })));
  
  return { hash: createHash("sha256").update(normalized).digest("hex"), entities: {}, tables };
}

// Helper: Extract entities from schemas
function extractEntitiesFromSchemas(schemas: any): any {
  const entities: any = {};
  if (!schemas) return entities;
  for (const [name, def] of Object.entries(schemas)) {
    if (def && typeof def === 'object' && 'database' in (def as any)) {
      entities[name] = def;
    }
  }
  return entities;
}

// Helper: Normalize entities
function normalizeEntities(entities: any): any {
  const normalized: any = {};
  for (const [name, def] of Object.entries(entities)) {
    const d = def as any;
    const dbConfig = typeof d.database === "string" ? { table: d.database } : d.database;
    const tableName = dbConfig?.table || d.table || name.toLowerCase();
    normalized[name] = { ...d, table: tableName, database: dbConfig || { table: tableName } };
  }
  return normalized;
}
