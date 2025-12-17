import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, resolve, relative } from "path";

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

    // Check if we're in a monorepo (has packages/ directory)
    let yamaCorePath: string | undefined;
    let currentDir = configDir;
    const startDir = currentDir;
    
    // Walk up to find packages/core directory (max 10 levels to avoid infinite loops)
    for (let i = 0; i < 10; i++) {
      const packagesPath = join(currentDir, "packages", "core");
      if (existsSync(packagesPath)) {
        // We're in a monorepo, calculate relative path to core package
        const coreSrcPath = join(packagesPath, "src", "index.ts");
        if (existsSync(coreSrcPath)) {
          const relativePath = relative(configDir, coreSrcPath)
            .replace(/\\/g, "/")
            .replace(/\.ts$/, "");
          yamaCorePath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
        }
        break;
      }
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }
      currentDir = parentDir;
    }

    // Update Yama paths
    const yamaPaths: Record<string, string[]> = {
      "@gen": [".yama/gen/index.ts"],
      "@gen/db": [".yama/gen/db"],
      "@gen/sdk": [".yama/gen/sdk"],
      "@gen/types": [".yama/gen/types.ts"],
      "@yamajs/gen": [".yama/gen/index.ts"],
    };

    // Add @yamajs/core path if we're in a monorepo
    // Otherwise, it should resolve from node_modules automatically
    if (yamaCorePath) {
      yamaPaths["@yamajs/core"] = [yamaCorePath];
    }

    tsconfig.compilerOptions.paths = {
      ...tsconfig.compilerOptions.paths,
      ...yamaPaths,
    };

    // Write back
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n", "utf-8");
  } catch (error) {
    // Silently fail if tsconfig.json is invalid or can't be updated
    console.warn(`âš ï¸  Could not update tsconfig.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

