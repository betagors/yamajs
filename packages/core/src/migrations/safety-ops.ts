import type { MigrationStepUnion } from "./diff.js";
import type { DatabaseCapabilities } from "./plugin-interface.js";
import { generateShadowColumnName, registerShadowColumn, calculateExpirationDate } from "./shadows.js";
import { registerBackup, generateBackupFilename, calculateChecksum, ensureBackupDirs } from "./backups.js";
import { CREATE_AUDIT_LOG_TABLE_SQL, createAuditEntry, shouldAudit, type AuditConfig } from "./audit.js";

/**
 * Safety operation options
 */
export interface SafetyOptions {
  /** Enable shadow columns for destructive operations */
  enableShadows?: boolean;
  /** Enable data snapshots before destructive operations */
  enableSnapshots?: boolean;
  /** Enable audit logging */
  enableAudit?: boolean;
  /** Shadow column retention in days */
  shadowRetentionDays?: number;
  /** Backup retention policy */
  backupRetention?: string;
  /** Audit configuration */
  auditConfig?: AuditConfig;
}

/**
 * Default safety options
 */
export const DEFAULT_SAFETY_OPTIONS: SafetyOptions = {
  enableShadows: true,
  enableSnapshots: true,
  enableAudit: false,
  shadowRetentionDays: 30,
  backupRetention: "30d",
};

/**
 * Result of safety pre-checks
 */
export interface SafetyPreCheckResult {
  /** Steps that need shadow columns */
  shadowSteps: MigrationStepUnion[];
  /** Steps that need data snapshots */
  snapshotSteps: MigrationStepUnion[];
  /** Steps to audit */
  auditSteps: MigrationStepUnion[];
  /** Total destructive steps */
  destructiveCount: number;
  /** Whether any safety measures are needed */
  needsSafety: boolean;
}

/**
 * Check which steps need safety measures
 */
export function checkSafetyNeeds(
  steps: MigrationStepUnion[],
  capabilities: DatabaseCapabilities,
  options: SafetyOptions = DEFAULT_SAFETY_OPTIONS
): SafetyPreCheckResult {
  const shadowSteps: MigrationStepUnion[] = [];
  const snapshotSteps: MigrationStepUnion[] = [];
  const auditSteps: MigrationStepUnion[] = [];
  let destructiveCount = 0;

  for (const step of steps) {
    const isDestructive = isDestructiveStep(step);
    
    if (isDestructive) {
      destructiveCount++;
      
      // Shadow columns for drop_column (if supported)
      if (step.type === "drop_column" && options.enableShadows && capabilities.shadowColumns) {
        shadowSteps.push(step);
      }
      
      // Snapshots for drop_table and drop_column
      if ((step.type === "drop_table" || step.type === "drop_column") && options.enableSnapshots) {
        snapshotSteps.push(step);
      }
    }
    
    // All steps can be audited
    if (options.enableAudit) {
      auditSteps.push(step);
    }
  }

  return {
    shadowSteps,
    snapshotSteps,
    auditSteps,
    destructiveCount,
    needsSafety: shadowSteps.length > 0 || snapshotSteps.length > 0,
  };
}

/**
 * Check if a step is destructive
 */
export function isDestructiveStep(step: MigrationStepUnion): boolean {
  return step.type === "drop_table" || step.type === "drop_column" || step.type === "drop_index";
}

/**
 * Generate SQL for shadow column creation (rename instead of drop)
 */
export function generateShadowSQL(
  step: MigrationStepUnion,
  snapshotHash: string
): { shadowSQL: string; shadowColumnName: string } | null {
  if (step.type !== "drop_column") {
    return null;
  }

  const shadowColumnName = generateShadowColumnName(step.column, snapshotHash);
  const shadowSQL = `ALTER TABLE ${step.table} RENAME COLUMN ${step.column} TO ${shadowColumnName};`;
  
  return { shadowSQL, shadowColumnName };
}

/**
 * Generate SQL for data snapshot (copy table data)
 */
export function generateSnapshotSQL(
  step: MigrationStepUnion,
  snapshotName: string
): string | null {
  if (step.type === "drop_table") {
    return `CREATE TABLE ${snapshotName} AS SELECT * FROM ${step.table};`;
  }
  
  if (step.type === "drop_column") {
    // Can't easily snapshot just a column - rely on full table backup or shadow
    return null;
  }
  
  return null;
}

/**
 * Register safety operations in manifest
 */
export function registerSafetyOperations(
  configDir: string,
  step: MigrationStepUnion,
  snapshotHash: string,
  options: SafetyOptions = DEFAULT_SAFETY_OPTIONS
): void {
  if (step.type === "drop_column" && options.enableShadows) {
    const shadowName = generateShadowColumnName(step.column, snapshotHash);
    registerShadowColumn(configDir, {
      column: shadowName,
      originalName: step.column,
      table: step.table,
      snapshot: snapshotHash,
      createdAt: new Date().toISOString(),
      expiresAt: calculateExpirationDate(options.shadowRetentionDays || 30),
      status: "active",
    });
  }
}

/**
 * Get SQL to create audit log table
 */
export function getAuditTableSQL(): string {
  return CREATE_AUDIT_LOG_TABLE_SQL;
}

/**
 * Create audit entry for a migration step
 */
export function createStepAuditEntry(
  step: MigrationStepUnion,
  snapshotHash: string,
  changedBy?: string
) {
  const stepData = step as unknown as Record<string, unknown>;
  return createAuditEntry(
    step.table,
    `step_${step.type}`,
    step.type.startsWith("drop") ? "DELETE" : step.type.startsWith("add") ? "INSERT" : "UPDATE",
    step.type.startsWith("drop") ? stepData : null,
    step.type.startsWith("add") ? stepData : null,
    snapshotHash,
    {
      changedBy,
      changedVia: "yama-deploy",
      metadata: { stepType: step.type },
    }
  );
}

/**
 * Generate complete safety-aware migration SQL
 */
export function generateSafetyAwareSQL(
  steps: MigrationStepUnion[],
  generateStepSQL: (step: MigrationStepUnion) => string,
  snapshotHash: string,
  capabilities: DatabaseCapabilities,
  options: SafetyOptions = DEFAULT_SAFETY_OPTIONS
): { sql: string; shadowColumns: string[]; snapshots: string[] } {
  const sqlParts: string[] = [];
  const shadowColumns: string[] = [];
  const snapshots: string[] = [];

  const safetyCheck = checkSafetyNeeds(steps, capabilities, options);

  for (const step of steps) {
    // Handle shadow columns for drop_column
    if (step.type === "drop_column" && safetyCheck.shadowSteps.includes(step)) {
      const shadow = generateShadowSQL(step, snapshotHash);
      if (shadow) {
        sqlParts.push(`-- Safety: Rename to shadow column instead of dropping`);
        sqlParts.push(shadow.shadowSQL);
        shadowColumns.push(shadow.shadowColumnName);
        continue; // Skip the original drop
      }
    }

    // Handle data snapshots for drop_table
    if (step.type === "drop_table" && safetyCheck.snapshotSteps.includes(step)) {
      const snapshotName = `${step.table}_before_${snapshotHash.substring(0, 8)}`;
      const snapshotSQL = generateSnapshotSQL(step, snapshotName);
      if (snapshotSQL) {
        sqlParts.push(`-- Safety: Create data snapshot before drop`);
        sqlParts.push(snapshotSQL);
        snapshots.push(snapshotName);
      }
    }

    // Generate normal SQL for the step
    const stepSQL = generateStepSQL(step);
    if (stepSQL) {
      sqlParts.push(stepSQL);
    }
  }

  return {
    sql: sqlParts.join("\n"),
    shadowColumns,
    snapshots,
  };
}
