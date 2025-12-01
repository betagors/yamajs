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
export declare const DEFAULT_RETENTION_DAYS = 30;
/**
 * Calculate expiration date
 */
export declare function calculateExpirationDate(retentionDays?: number): Date;
/**
 * Check if trash entry is expired
 */
export declare function isExpired(entry: TrashEntry): boolean;
/**
 * Trash entry status
 */
export type TrashStatus = "active" | "expired" | "restored";
