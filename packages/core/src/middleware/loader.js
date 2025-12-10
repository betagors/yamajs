import { readFileSync } from "fs";
import { extname, resolve } from "path";
import { pathToFileURL } from "url";
/**
 * Load middleware handler from a file
 * Supports both TypeScript and JavaScript files
 * Supports default export or named export
 */
export async function loadMiddlewareFromFile(filePath, projectDir) {
    // Resolve file path
    const resolvedPath = resolve(projectDir, filePath);
    // Check if file exists
    try {
        readFileSync(resolvedPath, "utf-8");
    }
    catch (error) {
        throw new Error(`Middleware file not found: ${filePath} (resolved to: ${resolvedPath})`);
    }
    // Determine if it's TypeScript or JavaScript
    const ext = extname(resolvedPath);
    const isTypeScript = ext === ".ts" || ext === ".tsx";
    // For TypeScript files, we need to use the compiled output
    // In development, this might be in a dist/ folder
    // In production, the file should already be compiled
    let importPath = resolvedPath;
    if (isTypeScript) {
        // Try to find compiled version in dist/ folder
        const distPath = resolvedPath.replace(/src\//, "dist/").replace(/\.tsx?$/, ".js");
        try {
            readFileSync(distPath, "utf-8");
            importPath = distPath;
        }
        catch {
            // If no dist version, try importing TypeScript directly (requires tsx/ts-node)
            importPath = resolvedPath;
        }
    }
    // Convert to file URL for ES module import
    const fileUrl = pathToFileURL(importPath).href;
    try {
        // Dynamic import
        const module = await import(fileUrl);
        // Try default export first
        if (module.default && typeof module.default === "function") {
            return module.default;
        }
        // Try named export "middleware"
        if (module.middleware && typeof module.middleware === "function") {
            return module.middleware;
        }
        // Try named export matching filename
        const fileName = filePath.split("/").pop()?.replace(/\.(ts|js|tsx|jsx)$/, "") || "middleware";
        const camelCaseName = fileName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        if (module[camelCaseName] && typeof module[camelCaseName] === "function") {
            return module[camelCaseName];
        }
        throw new Error(`Middleware file ${filePath} must export a default function or a named export "middleware" or "${camelCaseName}"`);
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load middleware from ${filePath}: ${error.message}`);
        }
        throw error;
    }
}
//# sourceMappingURL=loader.js.map