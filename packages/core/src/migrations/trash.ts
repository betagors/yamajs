/**
 * Trash/Recycle Bin system for migrations
 * Provides safety mechanism to prevent accidental data loss
 */

export interface TrashEntry {
  id: string;
  type: "migration" | "data_snapshot" | "schema_snapshot";
  name: string;
  original_path: string;
  trash_path: string;
  deleted_at: Date;
  expires_at: Date;
  metadata: {
    migration_hash?: string;
    table_name?: string;
    row_count?: number;
    size_bytes?: number;
    reason?: string;
  };
}

/**
 * Default retention period: 30 days
 */
export const DEFAULT_RETENTION_DAYS = 30;

/**
 * Calculate expiration date
 */
export function calculateExpirationDate(retentionDays: number = DEFAULT_RETENTION_DAYS): Date {
  const date = new Date();
  date.setDate(date.getDate() + retentionDays);
  return date;
}

/**
 * Check if trash entry is expired
 */
export function isExpired(entry: TrashEntry): boolean {
  return new Date() > entry.expires_at;
}

/**
 * Trash entry status
 */
export type TrashStatus = "active" | "expired" | "restored";

