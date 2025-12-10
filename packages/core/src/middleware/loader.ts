import { pathToFileURL } from "url";
import type { MiddlewareHandler } from "./types.js";
import { MiddlewareError, ErrorCodes } from "@betagors/yama-errors";
import { getFileSystem, getPathModule } from "../platform/fs.js";

/**
 * Load middleware handler from a file
 * Supports both TypeScript and JavaScript files
 * Supports default export or named export
 */
export async function loadMiddlewareFromFile(
  filePath: string,
  projectDir: string
): Promise<MiddlewareHandler> {
  const fs = getFileSystem();
  const path = getPathModule();
  // Resolve file path
  const resolvedPath = path.resolve(projectDir, filePath);
  
  // Check if file exists
  try {
    fs.readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    throw new MiddlewareError(
      `Middleware file not found: ${filePath}`,
      {
        code: ErrorCodes.MIDDLEWARE_NOT_FOUND,
        context: { filePath, resolvedPath },
        suggestions: [
          `Check that the middleware file exists at: ${resolvedPath}`,
          `Verify the path in your yama.yaml configuration`,
        ],
      }
    );
  }

  // Determine if it's TypeScript or JavaScript
  const ext = path.extname(resolvedPath);
  const isTypeScript = ext === ".ts" || ext === ".tsx";

  // For TypeScript files, we need to use the compiled output
  // In development, this might be in a dist/ folder
  // In production, the file should already be compiled
  let importPath = resolvedPath;
  
  if (isTypeScript) {
    // Try to find compiled version in dist/ folder
    const distPath = resolvedPath.replace(/src\//, "dist/").replace(/\.tsx?$/, ".js");
    try {
      fs.readFileSync(distPath, "utf-8");
      importPath = distPath;
    } catch {
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
      return module.default as MiddlewareHandler;
    }

    // Try named export "middleware"
    if (module.middleware && typeof module.middleware === "function") {
      return module.middleware as MiddlewareHandler;
    }

    // Try named export matching filename
    const fileName = filePath.split("/").pop()?.replace(/\.(ts|js|tsx|jsx)$/, "") || "middleware";
    const camelCaseName = fileName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (module[camelCaseName] && typeof module[camelCaseName] === "function") {
      return module[camelCaseName] as MiddlewareHandler;
    }

    throw new MiddlewareError(
      `Middleware file ${filePath} does not export a valid handler`,
      {
        code: ErrorCodes.MIDDLEWARE_NOT_FOUND,
        context: { filePath },
        suggestions: [
          `Export a default function or a named export "middleware" or "${camelCaseName}"`,
          `Example: export default async (context, next) => { await next(); }`,
        ],
      }
    );
  } catch (error) {
    // If it's already a MiddlewareError, re-throw
    if (error instanceof MiddlewareError) {
      throw error;
    }
    throw new MiddlewareError(
      `Failed to load middleware from ${filePath}`,
      {
        code: ErrorCodes.MIDDLEWARE_EXECUTION_FAILED,
        context: { filePath },
        cause: error instanceof Error ? error : undefined,
      }
    );
  }
}



















