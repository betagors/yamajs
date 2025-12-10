/**
 * Handler loading utilities for YAMA Node Runtime
 * 
 * This module handles dynamic loading of handler functions from files,
 * including import resolution for @betagors/yama-* and @gen/* packages.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, extname, resolve, relative } from "path";
import { pathToFileURL } from "url";
import { tmpdir } from "os";
import type { HandlerFunction } from "@betagors/yama-core";

/**
 * Resolve @betagors/yama-* and @gen/* imports using package.json exports
 * 
 * This function transforms import statements in handler files to use relative paths
 * instead of package exports. This is necessary for dynamic imports in development.
 * 
 * @param handlerContent - Source code content of the handler file
 * @param projectRoot - Project root directory containing package.json
 * @param fromPath - Path where the transformed file will be located (for relative path calculation)
 * @returns Transformed handler content with resolved imports
 * 
 * @example
 * ```typescript
 * // Before transformation:
 * import { Repository } from "@gen/db";
 * 
 * // After transformation:
 * import { Repository } from "../../.yama/gen/db/index.ts";
 * ```
 */
export function resolveYamaImports(handlerContent: string, projectRoot: string, fromPath: string): string {
  try {
    const packageJsonPath = join(projectRoot, "package.json");
    if (!existsSync(packageJsonPath)) {
      return handlerContent;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const exports = packageJson.exports || {};

    // Replace @betagors/yama-* and @gen/* imports with resolved paths
    let resolvedContent = handlerContent;
    for (const [exportPath, exportValue] of Object.entries(exports)) {
      if (exportPath.startsWith("@betagors/yama-") || exportPath.startsWith("@gen/")) {
        let resolvedPath: string;
        if (typeof exportValue === "string") {
          resolvedPath = exportValue;
        } else if (exportValue && typeof exportValue === "object" && "default" in exportValue) {
          resolvedPath = String((exportValue as { default?: string }).default || exportPath);
        } else {
          continue; // Skip if we can't resolve
        }
        
        // Convert to relative path from the file that will import it (fromPath)
        const absolutePath = resolve(projectRoot, resolvedPath);
        const fromDir = dirname(fromPath);
        let relativePath = relative(fromDir, absolutePath).replace(/\\/g, "/");
        
        // Ensure path starts with ./
        if (!relativePath.startsWith(".")) {
          relativePath = `./${relativePath}`;
        }
        
        // Ensure .ts extension is preserved for ES modules
        if (resolvedPath.endsWith(".ts") && !relativePath.endsWith(".ts")) {
          relativePath = `${relativePath}.ts`;
        }
        
        // Replace import statements (handle both import and import type)
        const importRegex = new RegExp(
          `(import\\s+(?:type\\s+)?[^"']*\\s+from\\s+["'])${exportPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'])`,
          "g"
        );
        resolvedContent = resolvedContent.replace(importRegex, `$1${relativePath}$2`);
      }
    }

    return resolvedContent;
  } catch (error) {
    // If resolution fails, return original content
    return handlerContent;
  }
}

/**
 * Load a handler function from a file path
 * 
 * Dynamically imports a handler function from a TypeScript or JavaScript file.
 * Handles import resolution, file extensions, and exports lookup.
 * 
 * @param handlerPath - Path to the handler file (relative to configDir or absolute)
 * @param configDir - Directory containing the yama.yaml config file
 * @returns The handler function or null if not found
 * 
 * @remarks
 * - Supports both .ts and .js files
 * - Automatically resolves @betagors/yama-* and @gen/* imports
 * - Looks for named export matching filename or default export
 * - Requires tsx for TypeScript file execution
 * 
 * @example
 * ```typescript
 * // Load handler from handlers/create-user.ts
 * const handler = await loadHandlerByPath("handlers/create-user", "/path/to/project");
 * if (handler) {
 *   const result = await handler(context);
 * }
 * ```
 */
export async function loadHandlerByPath(handlerPath: string, configDir: string): Promise<HandlerFunction | null> {
  // Resolve handler path relative to config directory
  let absoluteHandlerPath: string;
  if (resolve(handlerPath) === handlerPath) {
    // Absolute path
    absoluteHandlerPath = handlerPath;
  } else {
    // Relative path - resolve from config directory
    absoluteHandlerPath = resolve(configDir, handlerPath);
  }

  // Add .ts extension if not present
  if (!extname(absoluteHandlerPath)) {
    absoluteHandlerPath = `${absoluteHandlerPath}.ts`;
  }

  // Also try .js extension if .ts doesn't exist
  if (!existsSync(absoluteHandlerPath) && !absoluteHandlerPath.endsWith('.js')) {
    const jsPath = absoluteHandlerPath.replace(/\.ts$/, '.js');
    if (existsSync(jsPath)) {
      absoluteHandlerPath = jsPath;
    }
  }

  if (!existsSync(absoluteHandlerPath)) {
    console.warn(`⚠️  Handler file not found: ${absoluteHandlerPath}`);
    return null;
  }

  try {
    // Determine project root (directory containing package.json)
    let actualProjectRoot = configDir;
    let packageJsonPath = join(configDir, "package.json");
    
    // Walk up to find package.json
    while (!existsSync(packageJsonPath) && actualProjectRoot !== dirname(actualProjectRoot)) {
      actualProjectRoot = dirname(actualProjectRoot);
      packageJsonPath = join(actualProjectRoot, "package.json");
    }

    // Read handler content
    let handlerContent = readFileSync(absoluteHandlerPath, "utf-8");
    let importPath = absoluteHandlerPath;
    
    // Resolve @betagors/yama-* and @gen/* imports if package.json exists
    if (existsSync(packageJsonPath)) {
      // Determine where the file will be located (temp file or original)
      const tempDir = join(tmpdir(), "yama-handlers");
      const handlerFileName = absoluteHandlerPath.split(/[/\\]/).pop() || "handler";
      const tempPath = join(tempDir, `${handlerFileName}-${Date.now()}.ts`);
      
      // Resolve imports relative to where the file will be (temp file location)
      // This ensures relative paths are correct when the handler is loaded
      const transformedContent = resolveYamaImports(handlerContent, actualProjectRoot, tempPath);
      
      // If content was transformed, write to temp file
      if (transformedContent !== handlerContent) {
        mkdirSync(tempDir, { recursive: true });
        writeFileSync(tempPath, transformedContent, "utf-8");
        importPath = tempPath;
      }
    }

    // Convert to absolute path and then to file URL for ES module import
    const absolutePath = resolve(importPath);
    // Use file:// URL for ES module import
    // Note: When running with tsx, it will handle .ts files automatically
    const fileUrl = pathToFileURL(absolutePath).href;
    
    // Dynamic import for ES modules
    // For TypeScript files to work, the process must be run with tsx
    const handlerModule = await import(fileUrl);
    
    // Extract handler name from file path (filename without extension)
    const handlerName = absoluteHandlerPath.split(/[/\\]/).pop()?.replace(/\.(ts|js)$/, "") || "handler";
    
    // Look for exported function with the same name as the file
    // or default export
    const handlerFn = handlerModule[handlerName] || handlerModule.default;
    
    if (typeof handlerFn === "function") {
      console.log(`✅ Loaded handler: ${handlerPath}`);
      return handlerFn;
    } else {
      console.warn(`⚠️  Handler ${handlerPath} does not export a function (expected ${handlerName} or default)`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to load handler ${handlerPath}:`, error);
    return null;
  }
}
