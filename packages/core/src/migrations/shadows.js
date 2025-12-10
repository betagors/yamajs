import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
/**
 * Default retention period in days
 */
export const DEFAULT_SHADOW_RETENTION_DAYS = 30;
/**
 * Get shadows directory path
 */
export function getShadowsDir(configDir) {
    return join(configDir, ".yama", "shadows");
}
/**
 * Get shadow manifest file path
 */
export function getShadowManifestPath(configDir) {
    return join(getShadowsDir(configDir), "manifest.json");
}
/**
 * Ensure shadows directory exists
 */
export function ensureShadowsDir(configDir) {
    const shadowsDir = getShadowsDir(configDir);
    if (!existsSync(shadowsDir)) {
        mkdirSync(shadowsDir, { recursive: true });
    }
}
/**
 * Generate shadow column name
 */
export function generateShadowColumnName(originalName, snapshot, timestamp) {
    const ts = timestamp || new Date().toISOString().replace(/[:.]/g, "-");
    return `_shadow_${originalName}_${snapshot.substring(0, 8)}_${ts}`;
}
/**
 * Load shadow manifest
 */
export function loadShadowManifest(configDir) {
    const manifestPath = getShadowManifestPath(configDir);
    if (!existsSync(manifestPath)) {
        return { shadows: [] };
    }
    try {
        const content = readFileSync(manifestPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return { shadows: [] };
    }
}
/**
 * Save shadow manifest
 */
export function saveShadowManifest(configDir, manifest) {
    ensureShadowsDir(configDir);
    const manifestPath = getShadowManifestPath(configDir);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}
/**
 * Register a shadow column
 */
export function registerShadowColumn(configDir, shadow) {
    const manifest = loadShadowManifest(configDir);
    // Check if already exists
    const existingIndex = manifest.shadows.findIndex((s) => s.column === shadow.column && s.table === shadow.table);
    if (existingIndex >= 0) {
        manifest.shadows[existingIndex] = shadow;
    }
    else {
        manifest.shadows.push(shadow);
    }
    saveShadowManifest(configDir, manifest);
}
/**
 * Get shadow column by name
 */
export function getShadowColumn(configDir, table, column) {
    const manifest = loadShadowManifest(configDir);
    return (manifest.shadows.find((s) => s.table === table && s.column === column) || null);
}
/**
 * Get all shadow columns for a table
 */
export function getShadowColumnsForTable(configDir, table) {
    const manifest = loadShadowManifest(configDir);
    return manifest.shadows.filter((s) => s.table === table);
}
/**
 * Get all active shadow columns
 */
export function getActiveShadowColumns(configDir) {
    const manifest = loadShadowManifest(configDir);
    const now = new Date().toISOString();
    return manifest.shadows.filter((s) => s.status === "active" && s.expiresAt > now);
}
/**
 * Get all expired shadow columns
 */
export function getExpiredShadowColumns(configDir) {
    const manifest = loadShadowManifest(configDir);
    const now = new Date().toISOString();
    return manifest.shadows.filter((s) => s.status === "active" && s.expiresAt <= now);
}
/**
 * Mark shadow column as restored
 */
export function markShadowRestored(configDir, table, column) {
    const manifest = loadShadowManifest(configDir);
    const shadow = manifest.shadows.find((s) => s.table === table && s.column === column);
    if (shadow) {
        shadow.status = "restored";
        saveShadowManifest(configDir, manifest);
    }
}
/**
 * Delete shadow column from manifest
 */
export function deleteShadowColumn(configDir, table, column) {
    const manifest = loadShadowManifest(configDir);
    manifest.shadows = manifest.shadows.filter((s) => !(s.table === table && s.column === column));
    saveShadowManifest(configDir, manifest);
}
/**
 * Calculate expiration date
 */
export function calculateExpirationDate(retentionDays = DEFAULT_SHADOW_RETENTION_DAYS) {
    const date = new Date();
    date.setDate(date.getDate() + retentionDays);
    return date.toISOString();
}
/**
 * Check if shadow column is expired
 */
export function isShadowExpired(shadow) {
    const now = new Date().toISOString();
    return shadow.expiresAt <= now;
}
//# sourceMappingURL=shadows.js.map