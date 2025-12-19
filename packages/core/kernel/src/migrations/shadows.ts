import { getRuntime } from "../../../../../../../../../../../core/kernel/src/platform/index.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

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
export async function ensureShadowsDir(configDir: string): Promise<void> {
  const shadowsDir = getShadowsDir(configDir);
  if (!await fs().exists(shadowsDir)) {
    await fs().mkdir(shadowsDir);
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
export async function loadShadowManifest(configDir: string): Promise<ShadowManifest> {
  const manifestPath = getShadowManifestPath(configDir);
  if (!await fs().exists(manifestPath)) {
    return { shadows: [] };
  }

  try {
    const content = await fs().readTextFile(manifestPath);
    return JSON.parse(content) as ShadowManifest;
  } catch {
    return { shadows: [] };
  }
}

/**
 * Save shadow manifest
 */
export async function saveShadowManifest(configDir: string, manifest: ShadowManifest): Promise<void> {
  await ensureShadowsDir(configDir);
  const manifestPath = getShadowManifestPath(configDir);
  await fs().writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Register a shadow column
 */
export async function registerShadowColumn(
  configDir: string,
  shadow: ShadowColumn
): Promise<void> {
  const manifest = await loadShadowManifest(configDir);

  // Check if already exists
  const existingIndex = manifest.shadows.findIndex(
    (s) => s.column === shadow.column && s.table === shadow.table
  );

  if (existingIndex >= 0) {
    manifest.shadows[existingIndex] = shadow;
  } else {
    manifest.shadows.push(shadow);
  }

  await saveShadowManifest(configDir, manifest);
}

/**
 * Get shadow column by name
 */
export async function getShadowColumn(
  configDir: string,
  table: string,
  column: string
): Promise<ShadowColumn | null> {
  const manifest = await loadShadowManifest(configDir);
  return (
    manifest.shadows.find(
      (s) => s.table === table && s.column === column
    ) || null
  );
}

/**
 * Get all shadow columns for a table
 */
export async function getShadowColumnsForTable(
  configDir: string,
  table: string
): Promise<ShadowColumn[]> {
  const manifest = await loadShadowManifest(configDir);
  return manifest.shadows.filter((s) => s.table === table);
}

/**
 * Get all active shadow columns
 */
export async function getActiveShadowColumns(configDir: string): Promise<ShadowColumn[]> {
  const manifest = await loadShadowManifest(configDir);
  const now = new Date().toISOString();
  return manifest.shadows.filter(
    (s) => s.status === "active" && s.expiresAt > now
  );
}

/**
 * Get all expired shadow columns
 */
export async function getExpiredShadowColumns(configDir: string): Promise<ShadowColumn[]> {
  const manifest = await loadShadowManifest(configDir);
  const now = new Date().toISOString();
  return manifest.shadows.filter(
    (s) => s.status === "active" && s.expiresAt <= now
  );
}

/**
 * Mark shadow column as restored
 */
export async function markShadowRestored(
  configDir: string,
  table: string,
  column: string
): Promise<void> {
  const manifest = await loadShadowManifest(configDir);
  const shadow = manifest.shadows.find(
    (s) => s.table === table && s.column === column
  );

  if (shadow) {
    shadow.status = "restored";
    await saveShadowManifest(configDir, manifest);
  }
}

/**
 * Delete shadow column from manifest
 */
export async function deleteShadowColumn(
  configDir: string,
  table: string,
  column: string
): Promise<void> {
  const manifest = await loadShadowManifest(configDir);
  manifest.shadows = manifest.shadows.filter(
    (s) => !(s.table === table && s.column === column)
  );
  await saveShadowManifest(configDir, manifest);
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

/**
 * Shadow cleanup options
 */
export interface ShadowCleanupOptions {
  /** Only show what would be done */
  dryRun?: boolean;
  /** Skip expiration check - remove all */
  force?: boolean;
  /** Override expiration threshold (e.g., "30d") */
  olderThan?: string;
}

/**
 * Shadow cleanup result
 */
export interface ShadowCleanupResult {
  /** Shadows that were removed */
  removed: ShadowColumn[];
  /** Errors encountered */
  errors: Array<{ shadow: ShadowColumn; error: string }>;
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Shadow column with extended status info
 */
export interface ShadowColumnStatus extends ShadowColumn {
  /** Days until expiry (negative if expired) */
  daysUntilExpiry: number;
  /** Whether the shadow is expired */
  isExpired: boolean;
  /** Estimated size (if available) */
  estimatedSize?: string;
}

/**
 * Parse duration string to days (e.g., "30d" -> 30, "2w" -> 14)
 */
function parseDurationToDays(duration: string): number {
  const match = duration.match(/^(\d+)([dwmy])$/i);
  if (!match) return 30;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "d": return value;
    case "w": return value * 7;
    case "m": return value * 30;
    case "y": return value * 365;
    default: return value;
  }
}

/**
 * Generate SQL to drop a shadow column
 */
export function generateShadowDropSQL(shadow: ShadowColumn): string {
  return `ALTER TABLE "${shadow.table}" DROP COLUMN IF EXISTS "${shadow.column}";`;
}

/**
 * Generate SQL to restore a shadow column (rename back to original)
 */
export function generateShadowRestoreSQL(shadow: ShadowColumn): string {
  return `ALTER TABLE "${shadow.table}" RENAME COLUMN "${shadow.column}" TO "${shadow.originalName}";`;
}

/**
 * Generate SQL to drop multiple shadow columns
 */
export function generateShadowCleanupSQL(shadows: ShadowColumn[]): string[] {
  return shadows.map(generateShadowDropSQL);
}

/**
 * List all shadows with extended status information
 */
export async function listShadowsWithStatus(configDir: string): Promise<ShadowColumnStatus[]> {
  const manifest = await loadShadowManifest(configDir);
  const now = new Date();

  return manifest.shadows.map((shadow) => {
    const expiryDate = new Date(shadow.expiresAt);
    const diffMs = expiryDate.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      ...shadow,
      daysUntilExpiry,
      isExpired: daysUntilExpiry <= 0,
    };
  });
}

/**
 * Get cleanup candidates based on options
 */
export async function getCleanupCandidates(
  configDir: string,
  options: ShadowCleanupOptions = {}
): Promise<ShadowColumn[]> {
  const manifest = await loadShadowManifest(configDir);
  const now = new Date();

  if (options.force) {
    return manifest.shadows.filter(s => s.status === "active");
  }

  let thresholdDate = now;
  if (options.olderThan) {
    const days = parseDurationToDays(options.olderThan);
    thresholdDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return manifest.shadows.filter((shadow) => {
    if (shadow.status !== "active") return false;
    const expiryDate = new Date(shadow.expiresAt);
    return expiryDate <= thresholdDate || isShadowExpired(shadow);
  });
}

/**
 * Cleanup expired shadow columns
 */
export async function cleanupExpiredShadows(
  configDir: string,
  sql: any,
  options: ShadowCleanupOptions = {}
): Promise<ShadowCleanupResult> {
  const result: ShadowCleanupResult = {
    removed: [],
    errors: [],
    dryRun: options.dryRun ?? false,
  };

  const candidates = await getCleanupCandidates(configDir, options);

  if (candidates.length === 0) {
    return result;
  }

  for (const shadow of candidates) {
    if (options.dryRun) {
      result.removed.push(shadow);
      continue;
    }

    try {
      const dropSQL = generateShadowDropSQL(shadow);
      await sql.unsafe(dropSQL);

      // Update manifest
      await deleteShadowColumn(configDir, shadow.table, shadow.column);
      result.removed.push(shadow);
    } catch (error) {
      result.errors.push({
        shadow,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Restore a shadow column (rename back to original name)
 */
export async function restoreShadowColumn(
  configDir: string,
  sql: any,
  table: string,
  column: string
): Promise<{ success: boolean; error?: string }> {
  const shadow = await getShadowColumn(configDir, table, column);

  if (!shadow) {
    return { success: false, error: `Shadow column not found: ${table}.${column}` };
  }

  try {
    const restoreSQL = generateShadowRestoreSQL(shadow);
    await sql.unsafe(restoreSQL);

    // Update manifest
    await markShadowRestored(configDir, table, column);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format shadow list for CLI display
 */
export function formatShadowList(shadows: ShadowColumnStatus[]): string {
  if (shadows.length === 0) {
    return "No shadow columns found.";
  }

  const lines: string[] = [];
  lines.push(`Found ${shadows.length} shadow column(s):\n`);

  // Group by table
  const byTable = new Map<string, ShadowColumnStatus[]>();
  for (const shadow of shadows) {
    if (!byTable.has(shadow.table)) {
      byTable.set(shadow.table, []);
    }
    byTable.get(shadow.table)!.push(shadow);
  }

  for (const [table, tableShadows] of byTable) {
    lines.push(`📁 ${table}`);
    for (const shadow of tableShadows) {
      const icon = shadow.isExpired ? "🔴" : shadow.daysUntilExpiry <= 7 ? "🟡" : "🟢";
      const status = shadow.status === "restored" ? " (restored)" : shadow.isExpired ? " (expired)" : "";
      const expiry = shadow.isExpired
        ? `expired ${Math.abs(shadow.daysUntilExpiry)}d ago`
        : `expires in ${shadow.daysUntilExpiry}d`;

      lines.push(`   ${icon} ${shadow.column}${status}`);
      lines.push(`      Original: ${shadow.originalName} | ${expiry}`);
      if (shadow.size) {
        lines.push(`      Size: ${shadow.size}${shadow.rowCount ? ` (${shadow.rowCount} rows)` : ""}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format cleanup result for CLI display
 */
export function formatCleanupResult(result: ShadowCleanupResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push("🔍 DRY RUN - No actual changes made\n");
  }

  if (result.removed.length > 0) {
    const verb = result.dryRun ? "Would remove" : "Removed";
    lines.push(`✅ ${verb} ${result.removed.length} shadow column(s):`);
    for (const shadow of result.removed) {
      lines.push(`   - ${shadow.table}.${shadow.column} (was: ${shadow.originalName})`);
    }
    lines.push("");
  }

  if (result.errors.length > 0) {
    lines.push(`❌ Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      lines.push(`   - ${error.shadow.table}.${error.shadow.column}: ${error.error}`);
    }
    lines.push("");
  }

  if (result.removed.length === 0 && result.errors.length === 0) {
    lines.push("✅ No expired shadow columns to cleanup");
  }

  return lines.join("\n");
}














