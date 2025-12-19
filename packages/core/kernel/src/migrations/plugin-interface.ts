import type { MigrationStepUnion, MigrationStepType } from "./diff.js";
import { sha256Hex } from "../platform/hash.js";

/**
 * Database capabilities for migration operations
 */
export interface DatabaseCapabilities {
  /** Supports adding tables */
  addTable: boolean;
  /** Supports dropping tables */
  dropTable: boolean;
  /** Supports adding columns */
  addColumn: boolean;
  /** Supports dropping columns */
  dropColumn: boolean;
  /** Supports modifying column types */
  modifyColumnType: boolean;
  /** Supports changing column nullability */
  modifyColumnNullable: boolean;
  /** Supports changing column defaults */
  modifyColumnDefault: boolean;
  /** Supports renaming columns */
  renameColumn: boolean;
  /** Supports adding indexes */
  addIndex: boolean;
  /** Supports dropping indexes */
  dropIndex: boolean;
  /** Supports foreign keys */
  foreignKeys: boolean;
  /** Supports transactional DDL */
  transactionalDDL: boolean;
  /** Supports shadow columns for safe deletions */
  shadowColumns: boolean;
  /** Supports concurrent index creation */
  concurrentIndexes: boolean;
  /** Supports online DDL (minimal locking) */
  onlineDDL: boolean;
}

/**
 * Default capabilities (most databases support these)
 */
export const DEFAULT_CAPABILITIES: DatabaseCapabilities = {
  addTable: true,
  dropTable: true,
  addColumn: true,
  dropColumn: true,
  modifyColumnType: false,
  modifyColumnNullable: true,
  modifyColumnDefault: true,
  renameColumn: false,
  addIndex: true,
  dropIndex: true,
  foreignKeys: true,
  transactionalDDL: false,
  shadowColumns: false,
  concurrentIndexes: false,
  onlineDDL: false,
};

/**
 * PostgreSQL capabilities
 */
export const POSTGRES_CAPABILITIES: DatabaseCapabilities = {
  addTable: true,
  dropTable: true,
  addColumn: true,
  dropColumn: true,
  modifyColumnType: true,
  modifyColumnNullable: true,
  modifyColumnDefault: true,
  renameColumn: true,
  addIndex: true,
  dropIndex: true,
  foreignKeys: true,
  transactionalDDL: true,
  shadowColumns: true,
  concurrentIndexes: true,
  onlineDDL: true,
};

/**
 * SQLite capabilities
 */
export const SQLITE_CAPABILITIES: DatabaseCapabilities = {
  addTable: true,
  dropTable: true,
  addColumn: true,
  dropColumn: false, // SQLite doesn't support DROP COLUMN natively
  modifyColumnType: false,
  modifyColumnNullable: false,
  modifyColumnDefault: false,
  renameColumn: true,
  addIndex: true,
  dropIndex: true,
  foreignKeys: true,
  transactionalDDL: true,
  shadowColumns: false,
  concurrentIndexes: false,
  onlineDDL: false,
};

/**
 * MySQL capabilities
 */
export const MYSQL_CAPABILITIES: DatabaseCapabilities = {
  addTable: true,
  dropTable: true,
  addColumn: true,
  dropColumn: true,
  modifyColumnType: true,
  modifyColumnNullable: true,
  modifyColumnDefault: true,
  renameColumn: true,
  addIndex: true,
  dropIndex: true,
  foreignKeys: true,
  transactionalDDL: false, // MySQL DDL is not transactional
  shadowColumns: true,
  concurrentIndexes: false,
  onlineDDL: true, // With ALGORITHM=INPLACE
};

/**
 * Result of SQL generation
 */
export interface SQLGenerationResult {
  /** The SQL to execute */
  sql: string;
  /** Whether the operation is safe (non-destructive) */
  safe: boolean;
  /** Estimated execution time hint */
  estimatedTime?: "instant" | "fast" | "slow" | "unknown";
  /** Warning messages */
  warnings: string[];
  /** Steps that couldn't be generated */
  unsupportedSteps: MigrationStepUnion[];
}

/**
 * Migration plugin interface that database adapters must implement
 */
export interface MigrationPlugin {
  /** Plugin/database name */
  name: string;
  
  /** Database capabilities */
  capabilities: DatabaseCapabilities;
  
  /**
   * Generate SQL from migration steps
   * @param steps Migration steps to convert to SQL
   * @returns SQL generation result
   */
  generateSQL(steps: MigrationStepUnion[]): SQLGenerationResult;
  
  /**
   * Generate SQL for a single step
   * @param step Single migration step
   * @returns SQL string or null if not supported
   */
  generateStepSQL(step: MigrationStepUnion): string | null;
  
  /**
   * Check if a step type is supported
   * @param stepType The step type to check
   */
  supportsStep(stepType: MigrationStepType): boolean;
  
  /**
   * Get SQL for creating migration tracking tables
   */
  getMigrationTableSQL(): string;
  
  /**
   * Compute checksum for migration content
   */
  computeChecksum(content: string): string;
}

/**
 * Check if a step is supported by given capabilities
 */
export function isStepSupported(
  step: MigrationStepUnion,
  capabilities: DatabaseCapabilities
): boolean {
  switch (step.type) {
    case "add_table":
      return capabilities.addTable;
    case "drop_table":
      return capabilities.dropTable;
    case "add_column":
      return capabilities.addColumn;
    case "drop_column":
      return capabilities.dropColumn;
    case "modify_column":
      // Check specific modification capabilities
      if (step.changes.type && !capabilities.modifyColumnType) return false;
      if (step.changes.nullable !== undefined && !capabilities.modifyColumnNullable) return false;
      if (step.changes.default !== undefined && !capabilities.modifyColumnDefault) return false;
      return true;
    case "add_index":
      return capabilities.addIndex;
    case "drop_index":
      return capabilities.dropIndex;
    case "add_foreign_key":
    case "drop_foreign_key":
      return capabilities.foreignKeys;
    default:
      return false;
  }
}

/**
 * Validate steps against capabilities and return unsupported ones
 */
export function validateStepsAgainstCapabilities(
  steps: MigrationStepUnion[],
  capabilities: DatabaseCapabilities
): { supported: MigrationStepUnion[]; unsupported: MigrationStepUnion[] } {
  const supported: MigrationStepUnion[] = [];
  const unsupported: MigrationStepUnion[] = [];
  
  for (const step of steps) {
    if (isStepSupported(step, capabilities)) {
      supported.push(step);
    } else {
      unsupported.push(step);
    }
  }
  
  return { supported, unsupported };
}

/**
 * Create a base migration plugin with common functionality
 */
export function createBaseMigrationPlugin(
  name: string,
  capabilities: DatabaseCapabilities,
  generateStepSQL: (step: MigrationStepUnion) => string | null
): MigrationPlugin {
  return {
    name,
    capabilities,
    
    generateSQL(steps: MigrationStepUnion[]): SQLGenerationResult {
      const warnings: string[] = [];
      const unsupportedSteps: MigrationStepUnion[] = [];
      const sqlParts: string[] = [];
      let safe = true;
      
      for (const step of steps) {
        if (!isStepSupported(step, capabilities)) {
          unsupportedSteps.push(step);
          warnings.push(`Step ${step.type} on ${step.table} is not supported by ${name}`);
          continue;
        }
        
        const sql = generateStepSQL(step);
        if (sql) {
          sqlParts.push(sql);
        }
        
        // Check if destructive
        if (step.type === "drop_table" || step.type === "drop_column" || step.type === "drop_index") {
          safe = false;
        }
      }
      
      return {
        sql: sqlParts.join("\n"),
        safe,
        estimatedTime: steps.length > 10 ? "slow" : steps.length > 3 ? "fast" : "instant",
        warnings,
        unsupportedSteps,
      };
    },
    
    generateStepSQL,
    
    supportsStep(stepType: MigrationStepType): boolean {
      const mockStep = { type: stepType, table: "test" } as MigrationStepUnion;
      return isStepSupported(mockStep, capabilities);
    },
    
    getMigrationTableSQL(): string {
      return `
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
      `;
    },
    
    computeChecksum(content: string): string {
      return sha256Hex(content);
    },
  };
}
