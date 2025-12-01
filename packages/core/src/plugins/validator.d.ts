import type { YamaPlugin, PluginManifest } from "./base.js";
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors?: string[];
}
/**
 * Validate plugin manifest (all fields are optional now)
 */
export declare function validateManifest(manifest: PluginManifest): ValidationResult;
/**
 * Validate YamaPlugin interface
 */
export declare function validateYamaPlugin(plugin: unknown): ValidationResult;
/**
 * Validate plugin version compatibility
 */
export declare function validatePluginVersion(plugin: YamaPlugin, coreVersion: string): ValidationResult;
/**
 * Validate plugin configuration against config schema
 */
export declare function validatePluginConfig(config: Record<string, unknown>, manifest: PluginManifest): ValidationResult;
/**
 * Validate migration definitions in manifest
 */
export declare function validateMigrations(manifest: PluginManifest, pluginDir?: string): ValidationResult;
