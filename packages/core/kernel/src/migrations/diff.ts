import type { Model, TableModel, ColumnModel, IndexModel, ForeignKeyModel } from "./model.js";

/**
 * Result of comparing two models
 */
export interface DiffResult {
  added: {
    tables: string[];
    columns: Array<{ table: string; column: string }>;
    indexes: Array<{ table: string; index: string }>;
    foreignKeys: Array<{ table: string; fk: string }>;
  };
  removed: {
    tables: string[];
    columns: Array<{ table: string; column: string }>;
    indexes: Array<{ table: string; index: string }>;
    foreignKeys: Array<{ table: string; fk: string }>;
  };
  modified: {
    tables: Array<{ table: string; changes: string[] }>;
    columns: Array<{ table: string; column: string; changes: string[] }>;
  };
}

/**
 * Migration step types
 */
export type MigrationStepType =
  | "add_table"
  | "drop_table"
  | "add_column"
  | "drop_column"
  | "rename_column"
  | "modify_column"
  | "add_index"
  | "drop_index"
  | "add_foreign_key"
  | "drop_foreign_key";

/**
 * Base migration step
 */
export interface MigrationStep {
  type: MigrationStepType;
  table: string;
}

/**
 * Add table step
 */
export interface AddTableStep extends MigrationStep {
  type: "add_table";
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary?: boolean;
    default?: unknown;
    generated?: boolean;
  }>;
}

/**
 * Drop table step
 */
export interface DropTableStep extends MigrationStep {
  type: "drop_table";
}

/**
 * Add column step
 */
export interface AddColumnStep extends MigrationStep {
  type: "add_column";
  column: {
    name: string;
    type: string;
    nullable: boolean;
    default?: unknown;
    generated?: boolean;
  };
}

/**
 * Drop column step
 */
export interface DropColumnStep extends MigrationStep {
  type: "drop_column";
  column: string;
}

/**
 * Rename column step
 */
export interface RenameColumnStep extends MigrationStep {
  type: "rename_column";
  column: string;
  newName: string;
}

/**
 * Modify column step
 */
export interface ModifyColumnStep extends MigrationStep {
  type: "modify_column";
  column: string;
  changes: {
    type?: string;
    nullable?: boolean;
    default?: unknown;
  };
}

/**
 * Add index step
 */
export interface AddIndexStep extends MigrationStep {
  type: "add_index";
  index: {
    name: string;
    columns: string[];
    unique: boolean;
  };
}

/**
 * Drop index step
 */
export interface DropIndexStep extends MigrationStep {
  type: "drop_index";
  index: string;
}

/**
 * Add foreign key step
 */
export interface AddForeignKeyStep extends MigrationStep {
  type: "add_foreign_key";
  foreignKey: {
    name: string;
    columns: string[];
    references: {
      table: string;
      columns: string[];
    };
  };
}

/**
 * Drop foreign key step
 */
export interface DropForeignKeyStep extends MigrationStep {
  type: "drop_foreign_key";
  foreignKey: string;
}

/**
 * Union of all migration step types
 */
export type MigrationStepUnion =
  | AddTableStep
  | DropTableStep
  | AddColumnStep
  | DropColumnStep
  | RenameColumnStep
  | ModifyColumnStep
  | AddIndexStep
  | DropIndexStep
  | AddForeignKeyStep
  | DropForeignKeyStep;

/**
 * Compare two models and compute the diff
 */
export function computeDiff(from: Model, to: Model): DiffResult {
  const result: DiffResult = {
    added: {
      tables: [],
      columns: [],
      indexes: [],
      foreignKeys: [],
    },
    removed: {
      tables: [],
      columns: [],
      indexes: [],
      foreignKeys: [],
    },
    modified: {
      tables: [],
      columns: [],
    },
  };

  const fromTables = new Set(from.tables.keys());
  const toTables = new Set(to.tables.keys());

  // Find added tables
  for (const tableName of toTables) {
    if (!fromTables.has(tableName)) {
      result.added.tables.push(tableName);
    }
  }

  // Find removed tables
  for (const tableName of fromTables) {
    if (!toTables.has(tableName)) {
      result.removed.tables.push(tableName);
    }
  }

  // Compare tables that exist in both
  for (const tableName of fromTables) {
    if (toTables.has(tableName)) {
      const fromTable = from.tables.get(tableName)!;
      const toTable = to.tables.get(tableName)!;

      // Compare columns
      const fromColumns = new Set(fromTable.columns.keys());
      const toColumns = new Set(toTable.columns.keys());

      // Added columns
      for (const columnName of toColumns) {
        if (!fromColumns.has(columnName)) {
          result.added.columns.push({ table: tableName, column: columnName });
        }
      }

      // Removed columns
      for (const columnName of fromColumns) {
        if (!toColumns.has(columnName)) {
          result.removed.columns.push({ table: tableName, column: columnName });
        }
      }

      // Modified columns
      for (const columnName of fromColumns) {
        if (toColumns.has(columnName)) {
          const fromCol = fromTable.columns.get(columnName)!;
          const toCol = toTable.columns.get(columnName)!;
          const changes: string[] = [];

          if (fromCol.type !== toCol.type) {
            changes.push(`type: ${fromCol.type} → ${toCol.type}`);
          }
          if (fromCol.nullable !== toCol.nullable) {
            changes.push(`nullable: ${fromCol.nullable} → ${toCol.nullable}`);
          }
          if (fromCol.default !== toCol.default) {
            changes.push(`default: ${JSON.stringify(fromCol.default)} → ${JSON.stringify(toCol.default)}`);
          }

          if (changes.length > 0) {
            result.modified.columns.push({
              table: tableName,
              column: columnName,
              changes,
            });
          }
        }
      }

      // Compare indexes
      const fromIndexMap = new Map(fromTable.indexes.map((idx) => [idx.name, idx]));
      const toIndexMap = new Map(toTable.indexes.map((idx) => [idx.name, idx]));

      // Added indexes
      for (const [indexName, index] of toIndexMap) {
        if (!fromIndexMap.has(indexName)) {
          result.added.indexes.push({ table: tableName, index: indexName });
        }
      }

      // Removed indexes
      for (const [indexName, index] of fromIndexMap) {
        if (!toIndexMap.has(indexName)) {
          result.removed.indexes.push({ table: tableName, index: indexName });
        }
      }
      
      // Also detect indexes that should be removed because their columns are being removed
      // Check if any index columns are in the removed columns list
      for (const [indexName, index] of fromIndexMap) {
        // If index is on a column that's being removed, mark it for removal
        const hasRemovedColumn = index.columns.some((col: string) => {
          return result.removed.columns.some((removed: { table: string; column: string }) => 
            removed.table === tableName && removed.column === col
          );
        });
        // Only add if not already in removed list
        if (hasRemovedColumn && !result.removed.indexes.some(r => r.table === tableName && r.index === indexName)) {
          result.removed.indexes.push({ table: tableName, index: indexName });
        }
      }

      // Compare foreign keys
      const fromFKMap = new Map(fromTable.foreignKeys.map((fk) => [fk.name, fk]));
      const toFKMap = new Map(toTable.foreignKeys.map((fk) => [fk.name, fk]));

      // Added foreign keys
      for (const [fkName] of toFKMap) {
        if (!fromFKMap.has(fkName)) {
          result.added.foreignKeys.push({ table: tableName, fk: fkName });
        }
      }

      // Removed foreign keys
      for (const [fkName] of fromFKMap) {
        if (!toFKMap.has(fkName)) {
          result.removed.foreignKeys.push({ table: tableName, fk: fkName });
        }
      }
    }
  }

  return result;
}

/**
 * Convert diff result to migration steps
 */
export function diffToSteps(diff: DiffResult, from: Model, to: Model): MigrationStepUnion[] {
  const steps: MigrationStepUnion[] = [];

  // Add tables first
  for (const tableName of diff.added.tables) {
    const table = to.tables.get(tableName)!;
    steps.push({
      type: "add_table",
      table: tableName,
      columns: Array.from(table.columns.values()).map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        primary: col.primary,
        default: col.default,
        generated: col.generated,
      })),
    });
  }

  // Optimize: Detect case-only renames (drop + add with same name, different case)
  // PostgreSQL treats unquoted identifiers as case-insensitive, so we need to rename
  const caseOnlyRenames = new Map<string, { table: string; oldName: string; newName: string }>();
  
  for (const { table: tableName, column: columnName } of diff.added.columns) {
    // Check if there's a matching drop_column with same name (case-insensitive)
    const matchingDrop = diff.removed.columns.find(
      r => r.table === tableName && r.column.toLowerCase() === columnName.toLowerCase() && r.column !== columnName
    );
    
    if (matchingDrop) {
      // This is a case-only rename, mark it for rename instead of drop+add
      caseOnlyRenames.set(`${tableName}.${matchingDrop.column}`, {
        table: tableName,
        oldName: matchingDrop.column,
        newName: columnName,
      });
      // Remove from both lists so we don't process them as drop/add
      diff.removed.columns = diff.removed.columns.filter(r => r !== matchingDrop);
      continue;
    }
    
    // Regular add column
    const table = to.tables.get(tableName)!;
    const column = table.columns.get(columnName)!;
    steps.push({
      type: "add_column",
      table: tableName,
      column: {
        name: column.name,
        type: column.type,
        nullable: column.nullable,
        default: column.default,
        generated: column.generated,
      },
    });
  }
  
  // Add rename steps for case-only renames
  for (const rename of caseOnlyRenames.values()) {
    steps.push({
      type: "rename_column",
      table: rename.table,
      column: rename.oldName,
      newName: rename.newName,
    });
  }

  // Modify columns
  for (const { table: tableName, column: columnName, changes } of diff.modified.columns) {
    const toTable = to.tables.get(tableName)!;
    const toColumn = toTable.columns.get(columnName)!;
    const fromTable = from.tables.get(tableName)!;
    const fromColumn = fromTable.columns.get(columnName)!;

    const stepChanges: ModifyColumnStep["changes"] = {};
    if (fromColumn.type !== toColumn.type) {
      stepChanges.type = toColumn.type;
    }
    if (fromColumn.nullable !== toColumn.nullable) {
      stepChanges.nullable = toColumn.nullable;
    }
    if (fromColumn.default !== toColumn.default) {
      stepChanges.default = toColumn.default;
    }

    if (Object.keys(stepChanges).length > 0) {
      steps.push({
        type: "modify_column",
        table: tableName,
        column: columnName,
        changes: stepChanges,
      });
    }
  }

  // Add indexes
  // Note: Indexes are created AFTER renames, so they should use the NEW column names
  for (const { table: tableName, index: indexName } of diff.added.indexes) {
    const table = to.tables.get(tableName)!;
    const index = table.indexes.find((idx) => idx.name === indexName)!;
    steps.push({
      type: "add_index",
      table: tableName,
      index: {
        name: index.name,
        columns: index.columns, // Use new names (renames happen before indexes)
        unique: index.unique,
      },
    });
  }

  // Add foreign keys
  for (const { table: tableName, fk: fkName } of diff.added.foreignKeys) {
    const table = to.tables.get(tableName)!;
    const fk = table.foreignKeys.find((key) => key.name === fkName)!;
    steps.push({
      type: "add_foreign_key",
      table: tableName,
      foreignKey: {
        name: fk.name,
        columns: fk.columns,
        references: fk.references,
      },
    });
  }

  // Drop foreign keys
  for (const { table: tableName, fk: fkName } of diff.removed.foreignKeys) {
    steps.push({
      type: "drop_foreign_key",
      table: tableName,
      foreignKey: fkName,
    });
  }

  // Drop indexes
  for (const { table: tableName, index: indexName } of diff.removed.indexes) {
    steps.push({
      type: "drop_index",
      table: tableName,
      index: indexName,
    });
  }

  // Drop columns (excluding those that were converted to renames)
  for (const { table: tableName, column: columnName } of diff.removed.columns) {
    // Skip if this was handled as a rename
    if (caseOnlyRenames.has(`${tableName}.${columnName}`)) {
      continue;
    }
    steps.push({
      type: "drop_column",
      table: tableName,
      column: columnName,
    });
  }

  // Drop tables last
  for (const tableName of diff.removed.tables) {
    steps.push({
      type: "drop_table",
      table: tableName,
    });
  }

  return steps;
}

