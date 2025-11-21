import { join } from "path";

/**
 * Get the .yama directory path
 */
export function getYamaDir(configDir: string): string {
  return join(configDir, ".yama");
}

/**
 * Get the database code directory path
 */
export function getDbDir(configDir: string): string {
  return join(configDir, ".yama", "db");
}

/**
 * Get the SDK directory path
 */
export function getSdkDir(configDir: string): string {
  return join(configDir, ".yama", "sdk");
}

/**
 * Get the types file path
 */
export function getTypesPath(configDir: string): string {
  return join(configDir, ".yama", "types.ts");
}

/**
 * Get the migrations directory path (at root, not in .yama)
 */
export function getMigrationsDir(configDir: string): string {
  return join(configDir, "migrations");
}

/**
 * Get the cache directory path
 */
export function getCacheDir(configDir: string): string {
  return join(configDir, ".yama", "cache");
}

