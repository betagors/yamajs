/**
 * Trash/Recycle Bin system for migrations
 * Provides safety mechanism to prevent accidental data loss
 */
/**
 * Default retention period: 30 days
 */
export const DEFAULT_RETENTION_DAYS = 30;
/**
 * Calculate expiration date
 */
export function calculateExpirationDate(retentionDays = DEFAULT_RETENTION_DAYS) {
    const date = new Date();
    date.setDate(date.getDate() + retentionDays);
    return date;
}
/**
 * Check if trash entry is expired
 */
export function isExpired(entry) {
    return new Date() > entry.expires_at;
}
//# sourceMappingURL=trash.js.map