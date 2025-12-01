/**
 * SQL to create audit log table
 */
export const CREATE_AUDIT_LOG_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _yama_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  snapshot VARCHAR(255),
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  operation VARCHAR(10) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_via VARCHAR(255),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON _yama_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON _yama_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON _yama_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_snapshot ON _yama_audit_log(snapshot);
`;
/**
 * Check if an operation should be audited
 */
export function shouldAudit(config, entity, operation) {
    if (!config.enabled) {
        return false;
    }
    if (!config.track) {
        return true; // Track everything if no specific config
    }
    const entityConfig = config.track.find((t) => t.entity === entity);
    if (!entityConfig) {
        return false; // Entity not in tracking list
    }
    if (entityConfig.operations.includes("all")) {
        return true;
    }
    return entityConfig.operations.includes(operation);
}
/**
 * Create audit log entry
 */
export function createAuditEntry(tableName, recordId, operation, oldData, newData, snapshot, options) {
    const { randomUUID } = require("crypto");
    return {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        snapshot,
        table_name: tableName,
        record_id: recordId,
        operation,
        old_data: oldData,
        new_data: newData,
        changed_by: options?.changedBy,
        changed_via: options?.changedVia,
        metadata: options?.metadata,
    };
}
/**
 * Parse retention period string (e.g., "90d" -> 90 days)
 */
export function parseRetentionPeriod(retention) {
    const match = retention.match(/(\d+)([dwmy])/);
    if (!match) {
        return 90; // Default to 90 days
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
        case "d":
            return value;
        case "w":
            return value * 7;
        case "m":
            return value * 30;
        case "y":
            return value * 365;
        default:
            return value;
    }
}
/**
 * Check if audit log entry is expired
 */
export function isAuditEntryExpired(entry, retentionDays) {
    const entryDate = new Date(entry.timestamp);
    const expirationDate = new Date(entryDate);
    expirationDate.setDate(expirationDate.getDate() + retentionDays);
    return new Date() > expirationDate;
}
/**
 * Convert operation string to audit operation
 */
export function toAuditOperation(operation) {
    switch (operation) {
        case "create":
            return "INSERT";
        case "update":
            return "UPDATE";
        case "delete":
            return "DELETE";
        default:
            return "UPDATE";
    }
}
//# sourceMappingURL=audit.js.map