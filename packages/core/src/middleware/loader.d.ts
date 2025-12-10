import type { MiddlewareHandler } from "./types.js";
/**
 * Load middleware handler from a file
 * Supports both TypeScript and JavaScript files
 * Supports default export or named export
 */
export declare function loadMiddlewareFromFile(filePath: string, projectDir: string): Promise<MiddlewareHandler>;
