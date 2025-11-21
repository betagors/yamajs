import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Update TypeScript path mappings in tsconfig.json
 */
export function updateTypeScriptPaths(configDir: string): void {
  const tsconfigPath = join(configDir, "tsconfig.json");
  
  if (!existsSync(tsconfigPath)) {
    return;
  }

  try {
    const tsconfigContent = readFileSync(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(tsconfigContent);

    // Ensure compilerOptions exists
    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {};
    }

    // Ensure paths exists
    if (!tsconfig.compilerOptions.paths) {
      tsconfig.compilerOptions.paths = {};
    }

    // Update Yama paths
    tsconfig.compilerOptions.paths = {
      ...tsconfig.compilerOptions.paths,
      "@yama/db": [".yama/db"],
      "@yama/sdk": [".yama/sdk"],
      "@yama/types": [".yama/types.ts"],
    };

    // Write back
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n", "utf-8");
  } catch (error) {
    // Silently fail if tsconfig.json is invalid or can't be updated
    console.warn(`⚠️  Could not update tsconfig.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

