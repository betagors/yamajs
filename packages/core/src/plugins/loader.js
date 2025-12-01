import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { pathToFileURL } from "url";
/**
 * Load plugin manifest from package.json
 * @param packageName - Name of the package to load
 * @param projectDir - Optional project directory to resolve packages from (defaults to process.cwd())
 */
export async function loadPluginFromPackage(packageName, projectDir) {
    // Try to resolve the package
    let packagePath;
    try {
        const { createRequire } = await import("module");
        // Try to resolve from project directory (use process.cwd() if not provided)
        const projectRoot = projectDir || process.cwd();
        try {
            const projectRequire = createRequire(resolve(projectRoot, "package.json"));
            packagePath = projectRequire.resolve(packageName);
        }
        catch {
            // If that fails, try from current context (for workspace scenarios)
            try {
                const require = createRequire(import.meta.url);
                packagePath = require.resolve(packageName);
            }
            catch {
                // Re-throw the original error
                throw new Error(`Cannot find module '${packageName}'`);
            }
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Plugin package not found: ${packageName}. Install it with: npm install ${packageName}${errorMsg ? ` (Original error: ${errorMsg})` : ""}`);
    }
    // Find package.json
    let currentPath = packagePath;
    let packageJsonPath = null;
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
        throw new Error(`Plugin ${packageName} does not have "yama" metadata in package.json`);
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
export async function importPlugin(manifest, packageName, projectDir) {
    // Resolve entry point
    let entryPoint;
    let packageJson = {};
    try {
        const { createRequire } = await import("module");
        // Try to resolve from project directory (use process.cwd() if not provided)
        const projectRoot = projectDir || process.cwd();
        let packagePath;
        try {
            const projectRequire = createRequire(resolve(projectRoot, "package.json"));
            packagePath = projectRequire.resolve(packageName);
        }
        catch {
            // If that fails, try from current context (for workspace scenarios)
            const require = createRequire(import.meta.url);
            packagePath = require.resolve(packageName);
        }
        const packageDir = dirname(packagePath.replace(/\/[^/]+$/, "").replace(/\\[^\\]+$/, ""));
        entryPoint = join(packageDir, manifest.entryPoint || "./dist/plugin.ts");
        // Try to read package.json for version
        const packageJsonPath = join(packageDir, "package.json");
        if (existsSync(packageJsonPath)) {
            packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        }
    }
    catch (error) {
        throw new Error(`Could not resolve entry point for plugin ${packageName}: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Convert to file URL for ES module import
    const fileUrl = pathToFileURL(entryPoint).href;
    try {
        // Dynamic import
        const pluginModule = await import(fileUrl);
        // Look for default export or named export
        const plugin = pluginModule.default || pluginModule[packageName] || pluginModule.plugin;
        if (!plugin) {
            throw new Error(`Plugin ${packageName} does not export a plugin. Expected default export or named export "plugin".`);
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
        return plugin;
    }
    catch (error) {
        throw new Error(`Failed to import plugin ${packageName}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=loader.js.map