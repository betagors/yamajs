import { getFileSystem, getPathModule } from "../platform/fs.js";

const fs = () => getFileSystem();
const path = () => getPathModule();

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
export const DEFAULT_SHADOW_RETENTION_DAYS = 30;

/**
 * Get shadows directory path
 */
export function getShadowsDir(configDir: string): string {
  return path().join(configDir, ".yama", "shadows");
}

/**
 * Get shadow manifest file path
 */
export function getShadowManifestPath(configDir: string): string {
  return path().join(getShadowsDir(configDir), "manifest.json");
}

/**
 * Ensure shadows directory exists
 */
export function ensureShadowsDir(configDir: string): void {
  const shadowsDir = getShadowsDir(configDir);
  if (!fs().existsSync(shadowsDir)) {
    fs().mkdirSync(shadowsDir, { recursive: true });
  }
}

/**
 * Generate shadow column name
 */
export function generateShadowColumnName(
  originalName: string,
  snapshot: string,
  timestamp?: string
): string {
  const ts = timestamp || new Date().toISOString().replace(/[:.]/g, "-");
  return `_shadow_${originalName}_${snapshot.substring(0, 8)}_${ts}`;
}

/**
 * Load shadow manifest
 */
export function loadShadowManifest(configDir: string): ShadowManifest {
  const manifestPath = getShadowManifestPath(configDir);
  if (!fs().existsSync(manifestPath)) {
    return { shadows: [] };
  }
  
  try {
    const content = fs().readFileSync(manifestPath, "utf-8");
    return JSON.parse(content) as ShadowManifest;
  } catch {
    return { shadows: [] };
  }
}

/**
 * Save shadow manifest
 */
export function saveShadowManifest(configDir: string, manifest: ShadowManifest): void {
  ensureShadowsDir(configDir);
  const manifestPath = getShadowManifestPath(configDir);
  fs().writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

/**
 * Register a shadow column
 */
export function registerShadowColumn(
  configDir: string,
  shadow: ShadowColumn
): void {
  const manifest = loadShadowManifest(configDir);
  
  // Check if already exists
  const existingIndex = manifest.shadows.findIndex(
    (s) => s.column === shadow.column && s.table === shadow.table
  );
  
  if (existingIndex >= 0) {
    manifest.shadows[existingIndex] = shadow;
  } else {
    manifest.shadows.push(shadow);
  }
  
  saveShadowManifest(configDir, manifest);
}

/**
 * Get shadow column by name
 */
export function getShadowColumn(
  configDir: string,
  table: string,
  column: string
): ShadowColumn | null {
  const manifest = loadShadowManifest(configDir);
  return (
    manifest.shadows.find(
      (s) => s.table === table && s.column === column
    ) || null
  );
}

/**
 * Get all shadow columns for a table
 */
export function getShadowColumnsForTable(
  configDir: string,
  table: string
): ShadowColumn[] {
  const manifest = loadShadowManifest(configDir);
  return manifest.shadows.filter((s) => s.table === table);
}

/**
 * Get all active shadow columns
 */
export function getActiveShadowColumns(configDir: string): ShadowColumn[] {
  const manifest = loadShadowManifest(configDir);
  const now = new Date().toISOString();
  return manifest.shadows.filter(
    (s) => s.status === "active" && s.expiresAt > now
  );
}

/**
 * Get all expired shadow columns
 */
export function getExpiredShadowColumns(configDir: string): ShadowColumn[] {
  const manifest = loadShadowManifest(configDir);
  const now = new Date().toISOString();
  return manifest.shadows.filter(
    (s) => s.status === "active" && s.expiresAt <= now
  );
}

/**
 * Mark shadow column as restored
 */
export function markShadowRestored(
  configDir: string,
  table: string,
  column: string
): void {
  const manifest = loadShadowManifest(configDir);
  const shadow = manifest.shadows.find(
    (s) => s.table === table && s.column === column
  );
  
  if (shadow) {
    shadow.status = "restored";
    saveShadowManifest(configDir, manifest);
  }
}

/**
 * Delete shadow column from manifest
 */
export function deleteShadowColumn(
  configDir: string,
  table: string,
  column: string
): void {
  const manifest = loadShadowManifest(configDir);
  manifest.shadows = manifest.shadows.filter(
    (s) => !(s.table === table && s.column === column)
  );
  saveShadowManifest(configDir, manifest);
}

/**
 * Calculate expiration date
 */
export function calculateExpirationDate(
  retentionDays: number = DEFAULT_SHADOW_RETENTION_DAYS
): string {
  const date = new Date();
  date.setDate(date.getDate() + retentionDays);
  return date.toISOString();
}

/**
 * Check if shadow column is expired
 */
export function isShadowExpired(shadow: ShadowColumn): boolean {
  const now = new Date().toISOString();
  return shadow.expiresAt <= now;
}
















