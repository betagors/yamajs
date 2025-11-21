import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { ensureDir } from "./file-utils.js";

/**
 * Generate a cache key from content
 */
export function getCacheKey(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Get cached file content if it exists
 */
export function getCachedFile(cacheDir: string, key: string): string | null {
  const cachePath = join(cacheDir, `${key}.cache`);
  if (existsSync(cachePath)) {
    try {
      return readFileSync(cachePath, "utf-8");
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Set cached file content
 */
export function setCachedFile(cacheDir: string, key: string, content: string): void {
  ensureDir(cacheDir);
  const cachePath = join(cacheDir, `${key}.cache`);
  try {
    writeFileSync(cachePath, content, "utf-8");
  } catch (error) {
    // Silently fail cache writes
    console.warn(`⚠️  Failed to write cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clear all cache files
 */
export function clearCache(cacheDir: string): void {
  if (!existsSync(cacheDir)) {
    return;
  }
  
  try {
    const files = readdirSync(cacheDir);
    for (const file of files) {
      if (file.endsWith(".cache")) {
        unlinkSync(join(cacheDir, file));
      }
    }
  } catch (error) {
    console.warn(`⚠️  Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get cache key for config file
 */
export function getConfigCacheKey(configPath: string, config: unknown): string {
  const configContent = JSON.stringify(config, null, 0); // Sort keys for consistency
  return getCacheKey(`${configPath}:${configContent}`);
}

