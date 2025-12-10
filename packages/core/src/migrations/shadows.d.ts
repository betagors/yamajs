/**
 * Shadow column information
 */
export interface ShadowColumn {
    column: string;
    originalName: string;
    table: string;
    snapshot: string;
    createdAt: string;
    expiresAt: string;
    rowCount?: number;
    size?: string;
    status: "active" | "restored" | "expired";
}
/**
 * Shadow manifest
 */
export interface ShadowManifest {
    shadows: ShadowColumn[];
}
/**
 * Default retention period in days
 */
export declare const DEFAULT_SHADOW_RETENTION_DAYS = 30;
/**
 * Get shadows directory path
 */
export declare function getShadowsDir(configDir: string): string;
/**
 * Get shadow manifest file path
 */
export declare function getShadowManifestPath(configDir: string): string;
/**
 * Ensure shadows directory exists
 */
export declare function ensureShadowsDir(configDir: string): void;
/**
 * Generate shadow column name
 */
export declare function generateShadowColumnName(originalName: string, snapshot: string, timestamp?: string): string;
/**
 * Load shadow manifest
 */
export declare function loadShadowManifest(configDir: string): ShadowManifest;
/**
 * Save shadow manifest
 */
export declare function saveShadowManifest(configDir: string, manifest: ShadowManifest): void;
/**
 * Register a shadow column
 */
export declare function registerShadowColumn(configDir: string, shadow: ShadowColumn): void;
/**
 * Get shadow column by name
 */
export declare function getShadowColumn(configDir: string, table: string, column: string): ShadowColumn | null;
/**
 * Get all shadow columns for a table
 */
export declare function getShadowColumnsForTable(configDir: string, table: string): ShadowColumn[];
/**
 * Get all active shadow columns
 */
export declare function getActiveShadowColumns(configDir: string): ShadowColumn[];
/**
 * Get all expired shadow columns
 */
export declare function getExpiredShadowColumns(configDir: string): ShadowColumn[];
/**
 * Mark shadow column as restored
 */
export declare function markShadowRestored(configDir: string, table: string, column: string): void;
/**
 * Delete shadow column from manifest
 */
export declare function deleteShadowColumn(configDir: string, table: string, column: string): void;
/**
 * Calculate expiration date
 */
export declare function calculateExpirationDate(retentionDays?: number): string;
/**
 * Check if shadow column is expired
 */
export declare function isShadowExpired(shadow: ShadowColumn): boolean;
