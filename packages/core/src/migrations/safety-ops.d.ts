import type { MigrationStepUnion } from "./diff.js";
import type { DatabaseCapabilities } from "./plugin-interface.js";
import { type AuditConfig } from "./audit.js";
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
export declare const DEFAULT_SAFETY_OPTIONS: SafetyOptions;
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
export declare function checkSafetyNeeds(steps: MigrationStepUnion[], capabilities: DatabaseCapabilities, options?: SafetyOptions): SafetyPreCheckResult;
/**
 * Check if a step is destructive
 */
export declare function isDestructiveStep(step: MigrationStepUnion): boolean;
/**
 * Generate SQL for shadow column creation (rename instead of drop)
 */
export declare function generateShadowSQL(step: MigrationStepUnion, snapshotHash: string): {
    shadowSQL: string;
    shadowColumnName: string;
} | null;
/**
 * Generate SQL for data snapshot (copy table data)
 */
export declare function generateSnapshotSQL(step: MigrationStepUnion, snapshotName: string): string | null;
/**
 * Register safety operations in manifest
 */
export declare function registerSafetyOperations(configDir: string, step: MigrationStepUnion, snapshotHash: string, options?: SafetyOptions): void;
/**
 * Get SQL to create audit log table
 */
export declare function getAuditTableSQL(): string;
/**
 * Create audit entry for a migration step
 */
export declare function createStepAuditEntry(step: MigrationStepUnion, snapshotHash: string, changedBy?: string): import("./audit.js").AuditLogEntry;
/**
 * Generate complete safety-aware migration SQL
 */
export declare function generateSafetyAwareSQL(steps: MigrationStepUnion[], generateStepSQL: (step: MigrationStepUnion) => string, snapshotHash: string, capabilities: DatabaseCapabilities, options?: SafetyOptions): {
    sql: string;
    shadowColumns: string[];
    snapshots: string[];
};
//# sourceMappingURL=safety-ops.d.ts.map