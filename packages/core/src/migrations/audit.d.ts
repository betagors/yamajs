/**
 * Audit log entry
 */
export interface AuditLogEntry {
    id: string;
    timestamp: string;
    snapshot: string;
    table_name: string;
    record_id: string;
    operation: "INSERT" | "UPDATE" | "DELETE";
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_by?: string;
    changed_via?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Audit configuration
 */
export interface AuditConfig {
    enabled: boolean;
    track?: Array<{
        entity: string;
        operations: Array<"create" | "update" | "delete" | "all">;
    }>;
    retention?: string;
    storage?: "database" | "s3" | "file";
}
/**
 * SQL to create audit log table
 */
export declare const CREATE_AUDIT_LOG_TABLE_SQL = "\nCREATE TABLE IF NOT EXISTS _yama_audit_log (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),\n  snapshot VARCHAR(255),\n  table_name VARCHAR(255) NOT NULL,\n  record_id VARCHAR(255) NOT NULL,\n  operation VARCHAR(10) NOT NULL,\n  old_data JSONB,\n  new_data JSONB,\n  changed_by UUID,\n  changed_via VARCHAR(255),\n  metadata JSONB\n);\n\nCREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON _yama_audit_log(table_name, record_id);\nCREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON _yama_audit_log(timestamp);\nCREATE INDEX IF NOT EXISTS idx_audit_log_operation ON _yama_audit_log(operation);\nCREATE INDEX IF NOT EXISTS idx_audit_log_snapshot ON _yama_audit_log(snapshot);\n";
/**
 * Check if an operation should be audited
 */
export declare function shouldAudit(config: AuditConfig, entity: string, operation: "create" | "update" | "delete"): boolean;
/**
 * Create audit log entry
 */
export declare function createAuditEntry(tableName: string, recordId: string, operation: "INSERT" | "UPDATE" | "DELETE", oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null, snapshot: string, options?: {
    changedBy?: string;
    changedVia?: string;
    metadata?: Record<string, unknown>;
}): AuditLogEntry;
/**
 * Parse retention period string (e.g., "90d" -> 90 days)
 */
export declare function parseRetentionPeriod(retention: string): number;
/**
 * Check if audit log entry is expired
 */
export declare function isAuditEntryExpired(entry: AuditLogEntry, retentionDays: number): boolean;
/**
 * Convert operation string to audit operation
 */
export declare function toAuditOperation(operation: "create" | "update" | "delete"): "INSERT" | "UPDATE" | "DELETE";
