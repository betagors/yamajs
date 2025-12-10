/**
 * @betagors/yama-core - Migration Generator
 * 
 * Semi-automatic migration generation from entity changes.
 * Generates migration steps with preview and confirmation support.
 */

import type { YamaEntities } from "../entities.js";
import type { MigrationStepUnion, DiffResult } from "./diff.js";
import { entitiesToModel } from "./model.js";
import { computeDiff, diffToSteps } from "./diff.js";
import { computeSchemaHash, loadEntitySnapshot, getCurrentSchemaVersion } from "./versioning.js";
import { SafetyLevel, assessSafety } from "./safety.js";

/**
 * Options for migration generation
 */
export interface MigrationGeneratorOptions {
  /** Preview mode - show what would be generated without creating files */
  preview?: boolean;
  /** Interactive mode - prompt for confirmation */
  interactive?: boolean;
  /** Allow destructive operations (DROP) */
  destructive?: boolean;
  /** Include rollback steps */
  includeRollback?: boolean;
  /** Migration name/description */
  name?: string;
}

/**
 * Generated migration
 */
export interface GeneratedMigration {
  /** Migration name/identifier */
  name: string;
  /** When generated */
  generatedAt: string;
  /** Source schema hash */
  fromHash: string | null;
  /** Target schema hash */
  toHash: string;
  /** Up migration steps */
  up: MigrationStepUnion[];
  /** Down migration steps (rollback) */
  down: MigrationStepUnion[];
  /** Diff result for reference */
  diff: DiffResult;
  /** Safety assessment */
  safety: MigrationSafetyInfo;
  /** Whether migration has destructive operations */
  hasDestructiveOperations: boolean;
  /** Human-readable summary */
  summary: MigrationSummary;
}

/**
 * Migration safety information
 */
export interface MigrationSafetyInfo {
  level: SafetyLevel;
  warnings: string[];
  recommendations: string[];
  requiresBackup: boolean;
  requiresDowntime: boolean;
}

/**
 * Human-readable migration summary
 */
export interface MigrationSummary {
  description: string;
  changes: string[];
  tablesAdded: number;
  tablesRemoved: number;
  columnsAdded: number;
  columnsRemoved: number;
  columnsModified: number;
  indexesAdded: number;
  indexesRemoved: number;
}

/**
 * Generate migration name from timestamp
 */
function generateMigrationName(customName?: string): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  if (customName) {
    // Sanitize custom name
    const sanitized = customName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return `${timestamp}_${sanitized}`;
  }
  return `${timestamp}_migration`;
}

/**
 * Generate human-readable summary from diff
 */
function generateSummary(diff: DiffResult): MigrationSummary {
  const changes: string[] = [];
  
  // Tables
  if (diff.added.tables.length > 0) {
    changes.push(`Create tables: ${diff.added.tables.join(", ")}`);
  }
  if (diff.removed.tables.length > 0) {
    changes.push(`Drop tables: ${diff.removed.tables.join(", ")}`);
  }
  
  // Columns
  if (diff.added.columns.length > 0) {
    const byTable = groupByTable(diff.added.columns);
    for (const [table, cols] of Object.entries(byTable)) {
      changes.push(`Add columns to ${table}: ${cols.join(", ")}`);
    }
  }
  if (diff.removed.columns.length > 0) {
    const byTable = groupByTable(diff.removed.columns);
    for (const [table, cols] of Object.entries(byTable)) {
      changes.push(`Remove columns from ${table}: ${cols.join(", ")}`);
    }
  }
  if (diff.modified.columns.length > 0) {
    for (const mod of diff.modified.columns) {
      changes.push(`Modify ${mod.table}.${mod.column}: ${mod.changes.join(", ")}`);
    }
  }
  
  // Indexes
  if (diff.added.indexes.length > 0) {
    changes.push(`Add ${diff.added.indexes.length} index(es)`);
  }
  if (diff.removed.indexes.length > 0) {
    changes.push(`Remove ${diff.removed.indexes.length} index(es)`);
  }
  
  const description = changes.length > 0 
    ? changes.slice(0, 3).join("; ") + (changes.length > 3 ? ` (+${changes.length - 3} more)` : "")
    : "No changes detected";
  
  return {
    description,
    changes,
    tablesAdded: diff.added.tables.length,
    tablesRemoved: diff.removed.tables.length,
    columnsAdded: diff.added.columns.length,
    columnsRemoved: diff.removed.columns.length,
    columnsModified: diff.modified.columns.length,
    indexesAdded: diff.added.indexes.length,
    indexesRemoved: diff.removed.indexes.length,
  };
}

/**
 * Group column changes by table
 */
function groupByTable(items: Array<{ table: string; column: string }>): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const item of items) {
    if (!result[item.table]) {
      result[item.table] = [];
    }
    result[item.table].push(item.column);
  }
  return result;
}

/**
 * Check if migration has destructive operations
 */
function hasDestructiveOps(steps: MigrationStepUnion[]): boolean {
  return steps.some(step => 
    step.type === "drop_table" || 
    step.type === "drop_column" ||
    step.type === "drop_foreign_key"
  );
}

/**
 * Assess migration safety
 */
function assessMigrationSafety(
  steps: MigrationStepUnion[],
  diff: DiffResult
): MigrationSafetyInfo {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let requiresBackup = false;
  let requiresDowntime = false;
  let level = SafetyLevel.Safe;
  
  // Check for destructive operations
  const droppedTables = diff.removed.tables;
  const droppedColumns = diff.removed.columns;
  
  if (droppedTables.length > 0) {
    level = SafetyLevel.Dangerous;
    warnings.push(`Dropping ${droppedTables.length} table(s) will permanently delete data`);
    requiresBackup = true;
  }
  
  if (droppedColumns.length > 0) {
    level = Math.max(level, SafetyLevel.Unsafe);
    warnings.push(`Dropping ${droppedColumns.length} column(s) will permanently delete data`);
    requiresBackup = true;
  }
  
  // Check for type changes that might lose data
  for (const mod of diff.modified.columns) {
    if (mod.changes.some(c => c.startsWith("type:"))) {
      level = Math.max(level, SafetyLevel.RequiresReview);
      warnings.push(`Type change on ${mod.table}.${mod.column} may cause data conversion issues`);
    }
    if (mod.changes.some(c => c.includes("nullable: true → false"))) {
      warnings.push(`Making ${mod.table}.${mod.column} non-nullable may fail if NULL values exist`);
    }
  }
  
  // Check for large table additions (might take time)
  if (diff.added.tables.length > 3) {
    recommendations.push("Consider splitting migration into smaller batches");
  }
  
  // Add general recommendations
  if (requiresBackup) {
    recommendations.push("Create a database backup before running this migration");
  }
  
  if (level >= SafetyLevel.Unsafe) {
    recommendations.push("Test this migration on a staging database first");
    recommendations.push("Consider using shadow columns for zero-downtime migrations");
  }
  
  return {
    level,
    warnings,
    recommendations,
    requiresBackup,
    requiresDowntime: level === SafetyLevel.Dangerous,
  };
}

/**
 * Generate rollback steps from forward steps
 */
function generateRollbackSteps(
  steps: MigrationStepUnion[],
  fromEntities: YamaEntities | null,
  toEntities: YamaEntities
): MigrationStepUnion[] {
  const rollback: MigrationStepUnion[] = [];
  
  // Process steps in reverse order
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    
    switch (step.type) {
      case "add_table":
        rollback.push({ type: "drop_table", table: step.table });
        break;
        
      case "drop_table":
        // Need original table definition to restore
        if (fromEntities) {
          const fromModel = entitiesToModel(fromEntities);
          const table = fromModel.tables.get(step.table);
          if (table) {
            rollback.push({
              type: "add_table",
              table: step.table,
              columns: Array.from(table.columns.values()).map(col => ({
                name: col.name,
                type: col.type,
                nullable: col.nullable,
                primary: col.primary,
                default: col.default,
                generated: col.generated,
              })),
            });
          }
        }
        break;
        
      case "add_column":
        rollback.push({
          type: "drop_column",
          table: step.table,
          column: step.column.name,
        });
        break;
        
      case "drop_column":
        // Need original column definition to restore
        if (fromEntities) {
          const fromModel = entitiesToModel(fromEntities);
          const table = fromModel.tables.get(step.table);
          const column = table?.columns.get(step.column);
          if (column) {
            rollback.push({
              type: "add_column",
              table: step.table,
              column: {
                name: column.name,
                type: column.type,
                nullable: column.nullable,
                default: column.default,
                generated: column.generated,
              },
            });
          }
        }
        break;
        
      case "rename_column":
        rollback.push({
          type: "rename_column",
          table: step.table,
          column: step.newName,
          newName: step.column,
        });
        break;
        
      case "modify_column":
        // Need original column state to restore
        if (fromEntities) {
          const fromModel = entitiesToModel(fromEntities);
          const table = fromModel.tables.get(step.table);
          const column = table?.columns.get(step.column);
          if (column) {
            const changes: any = {};
            if (step.changes.type !== undefined) {
              changes.type = column.type;
            }
            if (step.changes.nullable !== undefined) {
              changes.nullable = column.nullable;
            }
            if (step.changes.default !== undefined) {
              changes.default = column.default;
            }
            if (Object.keys(changes).length > 0) {
              rollback.push({
                type: "modify_column",
                table: step.table,
                column: step.column,
                changes,
              });
            }
          }
        }
        break;
        
      case "add_index":
        rollback.push({
          type: "drop_index",
          table: step.table,
          index: step.index.name,
        });
        break;
        
      case "drop_index":
        // Need original index definition to restore
        if (fromEntities) {
          const fromModel = entitiesToModel(fromEntities);
          const table = fromModel.tables.get(step.table);
          const index = table?.indexes.find(idx => idx.name === step.index);
          if (index) {
            rollback.push({
              type: "add_index",
              table: step.table,
              index: {
                name: index.name,
                columns: index.columns,
                unique: index.unique,
              },
            });
          }
        }
        break;
        
      case "add_foreign_key":
        rollback.push({
          type: "drop_foreign_key",
          table: step.table,
          foreignKey: step.foreignKey.name,
        });
        break;
        
      case "drop_foreign_key":
        // Need original FK definition to restore
        if (fromEntities) {
          const fromModel = entitiesToModel(fromEntities);
          const table = fromModel.tables.get(step.table);
          const fk = table?.foreignKeys.find(f => f.name === step.foreignKey);
          if (fk) {
            rollback.push({
              type: "add_foreign_key",
              table: step.table,
              foreignKey: {
                name: fk.name,
                columns: fk.columns,
                references: fk.references,
              },
            });
          }
        }
        break;
    }
  }
  
  return rollback;
}

/**
 * Generate a migration from entity changes
 */
export async function generateMigration(
  projectDir: string,
  currentEntities: YamaEntities,
  options: MigrationGeneratorOptions = {}
): Promise<GeneratedMigration> {
  const { preview = false, destructive = false, includeRollback = true, name } = options;
  
  // Get previous version
  const currentVersion = getCurrentSchemaVersion(projectDir);
  const previousEntities = currentVersion 
    ? loadEntitySnapshot(projectDir, currentVersion.version) 
    : null;
  
  // Compute models
  const fromModel = previousEntities ? entitiesToModel(previousEntities) : entitiesToModel({});
  const toModel = entitiesToModel(currentEntities);
  
  // Compute diff
  const diff = computeDiff(fromModel, toModel);
  
  // Generate steps
  let steps = diffToSteps(diff, fromModel, toModel);
  
  // Filter destructive operations if not allowed
  if (!destructive) {
    const destructiveSteps = steps.filter(s => 
      s.type === "drop_table" || s.type === "drop_column"
    );
    if (destructiveSteps.length > 0) {
      throw new Error(
        `Migration contains ${destructiveSteps.length} destructive operation(s). ` +
        `Use --destructive flag to allow DROP operations.`
      );
    }
  }
  
  // Generate rollback steps
  const rollbackSteps = includeRollback 
    ? generateRollbackSteps(steps, previousEntities, currentEntities)
    : [];
  
  // Compute hashes
  const fromHash = currentVersion?.hash || null;
  const toHash = computeSchemaHash(currentEntities);
  
  // Generate summary and safety info
  const summary = generateSummary(diff);
  const safety = assessMigrationSafety(steps, diff);
  
  return {
    name: generateMigrationName(name),
    generatedAt: new Date().toISOString(),
    fromHash,
    toHash,
    up: steps,
    down: rollbackSteps,
    diff,
    safety,
    hasDestructiveOperations: hasDestructiveOps(steps),
    summary,
  };
}

/**
 * Format migration for display
 */
export function formatMigration(migration: GeneratedMigration): string {
  const lines: string[] = [];
  
  lines.push(`Migration: ${migration.name}`);
  lines.push(`Generated: ${migration.generatedAt}`);
  lines.push("");
  lines.push(`Summary: ${migration.summary.description}`);
  lines.push("");
  
  if (migration.safety.warnings.length > 0) {
    lines.push("⚠️  Warnings:");
    for (const warning of migration.safety.warnings) {
      lines.push(`   - ${warning}`);
    }
    lines.push("");
  }
  
  if (migration.safety.recommendations.length > 0) {
    lines.push("💡 Recommendations:");
    for (const rec of migration.safety.recommendations) {
      lines.push(`   - ${rec}`);
    }
    lines.push("");
  }
  
  lines.push("Changes:");
  for (const change of migration.summary.changes) {
    lines.push(`  - ${change}`);
  }
  
  lines.push("");
  lines.push(`Steps: ${migration.up.length} up, ${migration.down.length} down`);
  lines.push(`Safety Level: ${SafetyLevel[migration.safety.level]}`);
  
  return lines.join("\n");
}

/**
 * Check if entities have changed since last recorded version
 */
export function hasEntityChanges(
  projectDir: string,
  currentEntities: YamaEntities
): boolean {
  const currentVersion = getCurrentSchemaVersion(projectDir);
  if (!currentVersion) {
    return true; // No previous version means changes
  }
  
  const currentHash = computeSchemaHash(currentEntities);
  return currentHash !== currentVersion.hash;
}
