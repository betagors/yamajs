import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { pathToFileURL } from "url";
import type { PluginManifest, YamaPlugin } from "./base.js";

/**
 * Load plugin manifest from package.json
 */
export async function loadPluginFromPackage(
  packageName: string
): Promise<PluginManifest> {
  // Try to resolve the package
  let packagePath: string;
  try {
    // Use require.resolve to find the package
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    packagePath = require.resolve(packageName);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Plugin package not found: ${packageName}. Install it with: npm install ${packageName}${errorMsg ? ` (Original error: ${errorMsg})` : ""}`
    );
  }

  // Find package.json
  let currentPath = packagePath;
  let packageJsonPath: string | null = null;

  // Walk up the directory tree to find package.json
  while (currentPath !== dirname(currentPath)) {
    const potentialPath = join(currentPath, "package.json");
    if (existsSync(potentialPath)) {
      packageJsonPath = potentialPath;
      break;
    }
    currentPath = dirname(currentPath);
  }

  if (!packageJsonPath) {
    throw new Error(`Could not find package.json for plugin: ${packageName}`);
  }

  // Read and parse package.json
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  // Extract yama metadata
  const yamaMetadata = packageJson.yama;
  if (!yamaMetadata) {
    throw new Error(
      `Plugin ${packageName} does not have "yama" metadata in package.json`
    );
  }

  // Validate optional but recommended fields (warn only)
  // All fields are now optional to allow future-proof plugins

  return {
    pluginApi: yamaMetadata.pluginApi,
    yamaCore: yamaMetadata.yamaCore,
    category: yamaMetadata.category,
    type: yamaMetadata.type || "",
    service: yamaMetadata.service,
    entryPoint: yamaMetadata.entryPoint || "./dist/plugin.js",
    ...yamaMetadata,
  };
}

/**
 * Import plugin from manifest
 */
export async function importPlugin(
  manifest: PluginManifest,
  packageName: string
): Promise<YamaPlugin> {
  // Resolve entry point
  let entryPoint: string;
  let packageJson: { version?: string } = {};
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve(packageName);
    const packageDir = dirname(
      packagePath.replace(/\/[^/]+$/, "").replace(/\\[^\\]+$/, "")
    );
    entryPoint = join(packageDir, manifest.entryPoint || "./dist/plugin.js");
    
    // Try to read package.json for version
    const packageJsonPath = join(packageDir, "package.json");
    if (existsSync(packageJsonPath)) {
      packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    }
  } catch (error) {
    throw new Error(
      `Could not resolve entry point for plugin ${packageName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Convert to file URL for ES module import
  const fileUrl = pathToFileURL(entryPoint).href;

  try {
    // Dynamic import
    const pluginModule = await import(fileUrl);

    // Look for default export or named export
    const plugin =
      pluginModule.default || pluginModule[packageName] || pluginModule.plugin;

    if (!plugin) {
      throw new Error(
        `Plugin ${packageName} does not export a plugin. Expected default export or named export "plugin".`
      );
    }

    // Validate plugin structure
    if (typeof plugin.init !== "function") {
      throw new Error(`Plugin ${packageName} does not implement init() method`);
    }

    // Attach manifest if not present
    if (!plugin.manifest) {
      plugin.manifest = manifest;
    }

    // Attach name if not present
    if (!plugin.name) {
      plugin.name = packageName;
    }

    // Attach version from package.json if not present
    if (!plugin.version && packageJson.version) {
      plugin.version = packageJson.version;
    }

    // Attach metadata from manifest if not present
    if (manifest.category && !plugin.category) {
      plugin.category = manifest.category;
    }
    if (manifest.pluginApi && !plugin.pluginApi) {
      plugin.pluginApi = manifest.pluginApi;
    }
    if (manifest.yamaCore && !plugin.yamaCore) {
      plugin.yamaCore = manifest.yamaCore;
    }

    return plugin as YamaPlugin;
  } catch (error) {
    throw new Error(
      `Failed to import plugin ${packageName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

