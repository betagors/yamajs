import { pathToFileURL } from "url";
import type { PluginManifest, YamaPlugin } from "./base.js";
import { PluginError, ErrorCodes } from "@betagors/yama-errors";
import { getFileSystem, getPathModule } from "../platform/fs.js";
import { getEnvProvider } from "../platform/env.js";

/**
 * Load plugin manifest from package.json
 * @param packageName - Name of the package to load
 * @param projectDir - Optional project directory to resolve packages from (defaults to process.cwd())
 */
export async function loadPluginFromPackage(
  packageName: string,
  projectDir?: string
): Promise<PluginManifest> {
  const fs = getFileSystem();
  const path = getPathModule();
  // Try to resolve the package
  let packagePath: string;
  try {
    const { createRequire } = await import("module");
    
    // Try to resolve from project directory (use process.cwd() if not provided)
    const projectRoot = projectDir || getEnvProvider().cwd();
    try {
      const projectRequire = createRequire(path.resolve(projectRoot, "package.json"));
      packagePath = projectRequire.resolve(packageName);
    } catch {
      // If that fails, try from current context (for workspace scenarios)
      try {
        const require = createRequire(import.meta.url);
        packagePath = require.resolve(packageName);
      } catch {
        // Re-throw the original error
        throw new PluginError(`Cannot find module '${packageName}'`, {
          code: ErrorCodes.PLUGIN_NOT_FOUND,
          context: { packageName },
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new PluginError(
      `Plugin package not found: ${packageName}`,
      {
        code: ErrorCodes.PLUGIN_NOT_FOUND,
        context: { packageName },
        cause: error instanceof Error ? error : undefined,
        suggestions: [
          `Install it with: npm install ${packageName}`,
          `Check that the package name is correct`,
        ],
      }
    );
  }

  // Find package.json
  let currentPath = packagePath;
  let packageJsonPath: string | null = null;

  // Walk up the directory tree to find package.json
  while (currentPath !== path.dirname(currentPath)) {
    const potentialPath = path.join(currentPath, "package.json");
    if (fs.existsSync(potentialPath)) {
      packageJsonPath = potentialPath;
      break;
    }
    currentPath = path.dirname(currentPath);
  }

  if (!packageJsonPath) {
    throw new PluginError(`Could not find package.json for plugin: ${packageName}`, {
      code: ErrorCodes.PLUGIN_NOT_FOUND,
      context: { packageName },
      suggestions: [
        `Ensure the package is installed correctly`,
        `Check that the package has a valid package.json`,
      ],
    });
  }

  // Read and parse package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  // Extract yama metadata
  const yamaMetadata = packageJson.yama;
  if (!yamaMetadata) {
    throw new PluginError(
      `Plugin ${packageName} does not have "yama" metadata in package.json`,
      {
        code: ErrorCodes.PLUGIN_CONFIG_INVALID,
        context: { packageName },
        suggestions: [
          `Add a "yama" field to the plugin's package.json`,
          `See YAMA plugin documentation for the required metadata format`,
        ],
      }
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
    entryPoint: yamaMetadata.entryPoint || "./dist/plugin.ts",
    ...yamaMetadata,
  };
}

/**
 * Import plugin from manifest
 * @param manifest - Plugin manifest
 * @param packageName - Name of the package
 * @param projectDir - Optional project directory to resolve packages from (defaults to process.cwd())
 */
export async function importPlugin(
  manifest: PluginManifest,
  packageName: string,
  projectDir?: string
): Promise<YamaPlugin> {
  const fs = getFileSystem();
  const path = getPathModule();
  // Resolve entry point
  let entryPoint: string;
  let packageJson: { version?: string } = {};
  try {
    const { createRequire } = await import("module");
    
    // Try to resolve from project directory (use process.cwd() if not provided)
    const projectRoot = projectDir || getEnvProvider().cwd();
    let packagePath: string;
    try {
      const projectRequire = createRequire(path.resolve(projectRoot, "package.json"));
      packagePath = projectRequire.resolve(packageName);
    } catch {
      // If that fails, try from current context (for workspace scenarios)
      const require = createRequire(import.meta.url);
      packagePath = require.resolve(packageName);
    }
    
    const packageDir = dirname(
      packagePath.replace(/\/[^/]+$/, "").replace(/\\[^\\]+$/, "")
    );
    entryPoint = path.join(packageDir, manifest.entryPoint || "./dist/plugin.ts");
    
    // Try to read package.json for version
    const packageJsonPath = path.join(packageDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    }
  } catch (error) {
    throw new PluginError(
      `Could not resolve entry point for plugin ${packageName}`,
      {
        code: ErrorCodes.PLUGIN_INIT_FAILED,
        context: { packageName, entryPoint: manifest.entryPoint },
        cause: error instanceof Error ? error : undefined,
        suggestions: [
          `Check that the plugin's entryPoint in package.json is correct`,
          `Ensure the plugin has been built (run npm run build in the plugin directory)`,
        ],
      }
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
      throw new PluginError(
        `Plugin ${packageName} does not export a plugin`,
        {
          code: ErrorCodes.PLUGIN_CONFIG_INVALID,
          context: { packageName },
          suggestions: [
            `The plugin should have a default export or a named export called "plugin"`,
            `Check the plugin's source code for the correct export`,
          ],
        }
      );
    }

    // Validate plugin structure
    if (typeof plugin.init !== "function") {
      throw new PluginError(
        `Plugin ${packageName} does not implement init() method`,
        {
          code: ErrorCodes.PLUGIN_CONFIG_INVALID,
          context: { packageName },
          suggestions: [
            `All YAMA plugins must implement an init() method`,
            `See YAMA plugin documentation for the required interface`,
          ],
        }
      );
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
    // If it's already a PluginError, re-throw
    if (error instanceof PluginError) {
      throw error;
    }
    throw new PluginError(
      `Failed to import plugin ${packageName}`,
      {
        code: ErrorCodes.PLUGIN_INIT_FAILED,
        context: { packageName },
        cause: error instanceof Error ? error : undefined,
      }
    );
  }
}

