
import { getRuntime } from "../../../../../../../../../../../core/kernel/src/platform/index.js";

function getCrypto() {
  return getRuntime().crypto;
}

/**
 * Generate a UUID v4 using the crypto provider as fallback
 */
function generateFallbackUUID(): string {
  const bytes = getRuntime().crypto.randomBytes(16);
  // Set version (4) and variant (10)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
  retention?: string; // e.g., "90d"
  storage?: "database" | "s3" | "file";
}

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
export function shouldAudit(
  config: AuditConfig,
  entity: string,
  operation: "create" | "update" | "delete"
): boolean {
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
export function createAuditEntry(
  tableName: string,
  recordId: string,
  operation: "INSERT" | "UPDATE" | "DELETE",
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  snapshot: string,
  options?: {
    changedBy?: string;
    changedVia?: string;
    metadata?: Record<string, unknown>;
  }
): AuditLogEntry {
  // Use Runtime crypto
  const id = getRuntime().crypto.randomUUID();

  return {
    id,
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
export function parseRetentionPeriod(retention: string): number {
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
export function isAuditEntryExpired(
  entry: AuditLogEntry,
  retentionDays: number
): boolean {
  const entryDate = new Date(entry.timestamp);
  const expirationDate = new Date(entryDate);
  expirationDate.setDate(expirationDate.getDate() + retentionDays);

  return new Date() > expirationDate;
}

/**
 * Convert operation string to audit operation
 */
export function toAuditOperation(
  operation: "create" | "update" | "delete"
): "INSERT" | "UPDATE" | "DELETE" {
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

/**
 * Audit cleanup options
 */
export interface AuditCleanupOptions {
  /** Only show what would be done */
  dryRun?: boolean;
  /** Override retention from config (e.g., "90d") */
  retention?: string;
  /** Archive entries to file before deleting */
  archivePath?: string;
}

/**
 * Audit cleanup result
 */
export interface AuditCleanupResult {
  /** Number of entries deleted */
  deletedCount: number;
  /** Path to archive file if created */
  archivedPath?: string;
  /** Number of entries archived */
  archivedCount?: number;
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Audit log statistics
 */
export interface AuditStats {
  /** Total number of entries */
  totalEntries: number;
  /** Oldest entry timestamp */
  oldestEntry: string | null;
  /** Newest entry timestamp */
  newestEntry: string | null;
  /** Entries grouped by table */
  entriesByTable: Record<string, number>;
  /** Entries grouped by operation */
  entriesByOperation: Record<string, number>;
  /** Number of entries that would be deleted by retention */
  expiredCount: number;
}

/**
 * SQL to get audit log statistics
 */
const AUDIT_STATS_QUERY = `
  SELECT
    COUNT(*) as total_entries,
    MIN(timestamp) as oldest_entry,
    MAX(timestamp) as newest_entry
  FROM _yama_audit_log
`;

/**
 * SQL to get entries by table
 */
const AUDIT_BY_TABLE_QUERY = `
  SELECT table_name, COUNT(*) as count
  FROM _yama_audit_log
  GROUP BY table_name
  ORDER BY count DESC
`;

/**
 * SQL to get entries by operation
 */
const AUDIT_BY_OPERATION_QUERY = `
  SELECT operation, COUNT(*) as count
  FROM _yama_audit_log
  GROUP BY operation
`;

/**
 * SQL to count expired entries
 */
const AUDIT_EXPIRED_COUNT_QUERY = `
  SELECT COUNT(*) as count
  FROM _yama_audit_log
  WHERE timestamp < $1
`;

/**
 * SQL to delete expired entries
 */
const AUDIT_DELETE_EXPIRED_QUERY = `
  DELETE FROM _yama_audit_log
  WHERE timestamp < $1
  RETURNING id
`;

/**
 * SQL to get entries for archival
 */
const AUDIT_GET_EXPIRED_QUERY = `
  SELECT *
  FROM _yama_audit_log
  WHERE timestamp < $1
  ORDER BY timestamp ASC
`;

/**
 * Get audit log statistics
 */
export async function getAuditStats(
  sql: any,
  config?: AuditConfig
): Promise<AuditStats> {
  try {
    // Get basic stats
    const basicStats = await sql.unsafe(AUDIT_STATS_QUERY);
    const byTable = await sql.unsafe(AUDIT_BY_TABLE_QUERY);
    const byOperation = await sql.unsafe(AUDIT_BY_OPERATION_QUERY);

    // Calculate expired count if retention is configured
    let expiredCount = 0;
    if (config?.retention) {
      const retentionDays = parseRetentionPeriod(config.retention);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const expiredResult = await sql.unsafe(AUDIT_EXPIRED_COUNT_QUERY, [cutoffDate.toISOString()]);
      expiredCount = parseInt(expiredResult[0]?.count || "0", 10);
    }

    // Build result
    const entriesByTable: Record<string, number> = {};
    for (const row of byTable) {
      entriesByTable[row.table_name] = parseInt(row.count, 10);
    }

    const entriesByOperation: Record<string, number> = {};
    for (const row of byOperation) {
      entriesByOperation[row.operation] = parseInt(row.count, 10);
    }

    return {
      totalEntries: parseInt(basicStats[0]?.total_entries || "0", 10),
      oldestEntry: basicStats[0]?.oldest_entry || null,
      newestEntry: basicStats[0]?.newest_entry || null,
      entriesByTable,
      entriesByOperation,
      expiredCount,
    };
  } catch (error) {
    // Table might not exist
    return {
      totalEntries: 0,
      oldestEntry: null,
      newestEntry: null,
      entriesByTable: {},
      entriesByOperation: {},
      expiredCount: 0,
    };
  }
}

/**
 * Archive audit entries to a JSON file
 */
export async function archiveAuditEntries(
  sql: any,
  cutoffDate: Date,
  archivePath: string
): Promise<number> {
  const fs = getRuntime().fs;
  const path = getRuntime().path;

  // Get entries to archive
  const entries = await sql.unsafe(AUDIT_GET_EXPIRED_QUERY, [cutoffDate.toISOString()]);

  if (entries.length === 0) {
    return 0;
  }

  // Ensure directory exists
  const dir = path.dirname(archivePath);
  if (!(await fs.exists(dir))) {
    await fs.mkdir(dir);
  }

  // Write entries to file
  const archiveData = {
    archivedAt: new Date().toISOString(),
    cutoffDate: cutoffDate.toISOString(),
    entryCount: entries.length,
    entries: entries,
  };

  await fs.writeTextFile(archivePath, JSON.stringify(archiveData, null, 2));

  return entries.length;
}

/**
 * Cleanup expired audit entries
 */
export async function cleanupExpiredAuditEntries(
  sql: any,
  config: AuditConfig,
  options: AuditCleanupOptions = {}
): Promise<AuditCleanupResult> {
  const result: AuditCleanupResult = {
    deletedCount: 0,
    dryRun: options.dryRun ?? false,
  };

  // Calculate cutoff date
  const retention = options.retention || config.retention || "90d";
  const retentionDays = parseRetentionPeriod(retention);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Get count of entries to delete
  const countResult = await sql.unsafe(AUDIT_EXPIRED_COUNT_QUERY, [cutoffDate.toISOString()]);
  const expiredCount = parseInt(countResult[0]?.count || "0", 10);

  if (expiredCount === 0) {
    return result;
  }

  if (options.dryRun) {
    result.deletedCount = expiredCount;
    return result;
  }

  // Archive before deleting if requested
  if (options.archivePath) {
    result.archivedCount = await archiveAuditEntries(sql, cutoffDate, options.archivePath);
    result.archivedPath = options.archivePath;
  }

  // Delete expired entries
  const deleteResult = await sql.unsafe(AUDIT_DELETE_EXPIRED_QUERY, [cutoffDate.toISOString()]);
  result.deletedCount = deleteResult.length;

  return result;
}

/**
 * Format audit statistics for CLI display
 */
export function formatAuditStats(stats: AuditStats): string {
  const lines: string[] = [];

  lines.push("📊 Audit Log Statistics\n");
  lines.push(`   Total entries: ${stats.totalEntries.toLocaleString()}`);

  if (stats.oldestEntry) {
    lines.push(`   Oldest: ${stats.oldestEntry}`);
  }
  if (stats.newestEntry) {
    lines.push(`   Newest: ${stats.newestEntry}`);
  }

  if (stats.expiredCount > 0) {
    lines.push(`   ⚠️ Expired: ${stats.expiredCount.toLocaleString()}`);
  }

  lines.push("");

  // By table
  const tables = Object.entries(stats.entriesByTable);
  if (tables.length > 0) {
    lines.push("   By table:");
    for (const [table, count] of tables.slice(0, 10)) {
      lines.push(`     ${table}: ${count.toLocaleString()}`);
    }
    if (tables.length > 10) {
      lines.push(`     ... and ${tables.length - 10} more`);
    }
    lines.push("");
  }

  // By operation
  const ops = Object.entries(stats.entriesByOperation);
  if (ops.length > 0) {
    lines.push("   By operation:");
    for (const [op, count] of ops) {
      lines.push(`     ${op}: ${count.toLocaleString()}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format cleanup result for CLI display
 */
export function formatAuditCleanupResult(result: AuditCleanupResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push("🔍 DRY RUN - No actual changes made\n");
  }

  if (result.archivedPath && result.archivedCount) {
    const verb = result.dryRun ? "Would archive" : "Archived";
    lines.push(`📦 ${verb} ${result.archivedCount.toLocaleString()} entries to:`);
    lines.push(`   ${result.archivedPath}`);
    lines.push("");
  }

  if (result.deletedCount > 0) {
    const verb = result.dryRun ? "Would delete" : "Deleted";
    lines.push(`✅ ${verb} ${result.deletedCount.toLocaleString()} expired audit entries`);
  } else {
    lines.push("✅ No expired audit entries to cleanup");
  }

  return lines.join("\n");
}
