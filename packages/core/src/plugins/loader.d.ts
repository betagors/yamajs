import type { PluginManifest, YamaPlugin } from "./base.js";
/**
 * Load plugin manifest from package.json
 * @param packageName - Name of the package to load
 * @param projectDir - Optional project directory to resolve packages from (defaults to process.cwd())
 */
export declare function loadPluginFromPackage(packageName: string, projectDir?: string): Promise<PluginManifest>;
/**
 * Import plugin from manifest
 * @param manifest - Plugin manifest
 * @param packageName - Name of the package
 * @param projectDir - Optional project directory to resolve packages from (defaults to process.cwd())
 */
export declare function importPlugin(manifest: PluginManifest, packageName: string, projectDir?: string): Promise<YamaPlugin>;
