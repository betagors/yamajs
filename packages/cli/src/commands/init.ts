import { writeFileSync, existsSync, readFileSync, appendFileSync } from "fs";
import { join, basename, relative, dirname } from "path";
import { ensureDir, readPackageJson, writePackageJson } from "../utils/file-utils.ts";
import { getYamaDir, getDbDir, getSdkDir, getYamaSchemaPath } from "../utils/paths.ts";
import inquirer from "inquirer";
import { execSync } from "child_process";

/**
 * Find workspace root by looking for pnpm-workspace.yaml or package.json with workspaces
 */
function findWorkspaceRoot(startDir: string): string | null {
  let current = startDir;
  const root = join(current, "..", "..", ".."); // Go up a few levels max
  
  while (current !== root && current !== dirname(current)) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    if (existsSync(join(current, "package.json"))) {
      try {
        const pkg = JSON.parse(readFileSync(join(current, "package.json"), "utf-8"));
        if (pkg.workspaces || pkg.workspace) {
          return current;
        }
      } catch {
        // Ignore
      }
    }
    current = dirname(current);
  }
  return null;
}

interface InitOptions {
  name?: string;
  version?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const projectName = options.name || getProjectName(cwd);
  const version = options.version || "1.0.0";

  console.log("🚀 Initializing Yama project...\n");

  // Ask about plugins
  const pluginAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "database",
      message: "Which database would you like to use?",
      choices: [
        { name: "PostgreSQL", value: "@betagors/yama-postgres" },
        { name: "None (add later)", value: null },
      ],
      default: "@betagors/yama-postgres",
    },
  ]);

  const selectedPlugins: string[] = [];
  if (pluginAnswers.database) {
    selectedPlugins.push(pluginAnswers.database);
  }

  // Build plugins config
  let pluginsConfig = "";
  if (selectedPlugins.length > 0) {
    pluginsConfig = "\nplugins:\n";
    for (const plugin of selectedPlugins) {
      // Add database config inside plugin config if it's a database plugin
      if (plugin === "@betagors/yama-postgres") {
        pluginsConfig += `  ${plugin}:\n    url: \${DATABASE_URL}\n`;
      } else {
        pluginsConfig += `  ${plugin}: {}\n`;
      }
    }
  }

  const yamlContent = `name: ${projectName}
version: ${version}${pluginsConfig}
schemas:
  Example:
    fields:
      id:
        type: string
        required: true
      name:
        type: string
        required: true

endpoints:
  - path: /examples
    method: GET
    handler: getExamples
    response:
      type: Example
`;

  // Create yama.yaml FIRST (always create it)
  const yamaPath = join(cwd, "yama.yaml");
  if (existsSync(yamaPath)) {
    console.log("⚠️  yama.yaml already exists, skipping...");
  } else {
    // Add schema reference for autocomplete
    const schemaPath = getYamaSchemaPath(yamaPath);
    const yamlWithSchema = `# yaml-language-server: $schema=${schemaPath}
${yamlContent}`;
    writeFileSync(yamaPath, yamlWithSchema, "utf-8");
    console.log("✅ Created yama.yaml");
  }

  // Check if we're in a workspace (monorepo)
  const workspaceRoot = findWorkspaceRoot(cwd);
  const isInWorkspace = workspaceRoot !== null;
  
  // Install selected plugins
  if (selectedPlugins.length > 0) {
    console.log("\n📦 Installing plugins...");
    try {
      // Detect package manager
      const hasPnpm = existsSync(join(cwd, "pnpm-lock.yaml")) || existsSync(join(cwd, "../pnpm-workspace.yaml")) || isInWorkspace;
      const hasYarn = existsSync(join(cwd, "yarn.lock"));
      const packageManager = hasPnpm ? "pnpm" : hasYarn ? "yarn" : "npm";

      for (const plugin of selectedPlugins) {
        console.log(`  Installing ${plugin}...`);
        
        // Check if plugin exists as workspace package
        let pluginPath: string | null = null;
        if (isInWorkspace && workspaceRoot) {
          const possiblePaths = [
            join(workspaceRoot, "packages", plugin.replace("@betagors/yama-", "")),
            join(workspaceRoot, plugin.replace("@betagors/yama-", "")),
          ];
          for (const path of possiblePaths) {
            if (existsSync(join(path, "package.json"))) {
              pluginPath = path;
              break;
            }
          }
        }

        if (pluginPath) {
          // Use workspace protocol or file path
          // For pnpm workspace, use the package name directly if in workspace
          // For file paths, use relative path
          if (hasPnpm && isInWorkspace) {
            // In pnpm workspace, just use the package name - pnpm will resolve it
            execSync(`${packageManager} add ${plugin}`, { cwd, stdio: "inherit" });
          } else {
            const relativePath = relative(cwd, pluginPath).replace(/\\/g, "/");
            const pluginSpec = `file:${relativePath}`;
            execSync(`${packageManager} add ${pluginSpec}`, { cwd, stdio: "inherit" });
          }
        } else {
          // Try to install from npm
          try {
            execSync(`${packageManager} add ${plugin}`, { cwd, stdio: "inherit" });
          } catch (error) {
            // If npm install fails and we're in workspace, try workspace path
            if (isInWorkspace && workspaceRoot) {
              const fallbackPath = join(workspaceRoot, "packages", plugin.replace("@betagors/yama-", ""));
              if (existsSync(join(fallbackPath, "package.json"))) {
                // In pnpm workspace, just use package name
                if (hasPnpm) {
                  execSync(`${packageManager} add ${plugin}`, { cwd, stdio: "inherit" });
                } else {
                  const relativePath = relative(cwd, fallbackPath).replace(/\\/g, "/");
                  execSync(`${packageManager} add file:${relativePath}`, { cwd, stdio: "inherit" });
                }
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
      }
      console.log("✅ Plugins installed successfully");
    } catch (error) {
      console.warn(`⚠️  Failed to install plugins: ${error instanceof Error ? error.message : String(error)}`);
      console.log("   You can install them manually later");
    }
  }


  // Create src/handlers directory
  const handlersDir = join(cwd, "src", "handlers");
  ensureDir(handlersDir);
  console.log("✅ Created src/handlers/ directory");

  // Create .yama directory structure
  const yamaDir = getYamaDir(cwd);
  ensureDir(yamaDir);
  ensureDir(getDbDir(cwd));
  ensureDir(getSdkDir(cwd));
  console.log("✅ Created .yama/ directory structure");

  // Create example handler
  const exampleHandlerPath = join(handlersDir, "getExamples.ts");
  if (!existsSync(exampleHandlerPath)) {
    const handlerContent = `import type { GetExamplesHandlerContext, Example } from "@yama/gen";

export async function getExamples(
  context: GetExamplesHandlerContext
): Promise<Example> {
  return {
    id: "1",
    name: "Example"
  };
}
`;
    writeFileSync(exampleHandlerPath, handlerContent, "utf-8");
    console.log("✅ Created example handler: src/handlers/getExamples.ts");
  }

  // Update package.json if it exists
  const packageJsonPath = join(cwd, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = readPackageJson(packageJsonPath);
      
      // Add scripts if they don't exist
      if (!pkg.scripts) {
        pkg.scripts = {};
      }
      
      const scripts = pkg.scripts as Record<string, string>;
      if (!scripts["yama:dev"]) {
        scripts["yama:dev"] = "yama dev";
      }
      if (!scripts["yama:generate"]) {
        scripts["yama:generate"] = "yama generate";
      }
      if (!scripts["yama:validate"]) {
        scripts["yama:validate"] = "yama validate";
      }

      // Add exports field if it doesn't exist
      if (!pkg.exports) {
        pkg.exports = {
          "@gen/db": "./.yama/gen/db/index.ts",
          "@gen/types": "./.yama/gen/types.ts",
          "@gen/sdk": "./.yama/gen/sdk/index.ts",
        };
      } else {
        // Update existing exports to include gen paths if not present
        const exports = pkg.exports as Record<string, string>;
        if (!exports["@gen/db"]) {
          exports["@gen/db"] = "./.yama/gen/db/index.ts";
        }
        if (!exports["@gen/types"]) {
          exports["@gen/types"] = "./.yama/gen/types.ts";
        }
        if (!exports["@gen/sdk"]) {
          exports["@gen/sdk"] = "./.yama/gen/sdk/index.ts";
        }
      }

      writePackageJson(packageJsonPath, pkg);
      console.log("✅ Added scripts to package.json");
    } catch (error) {
      console.log("⚠️  Could not update package.json:", error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log("ℹ️  No package.json found - run 'npm init' first");
  }

  // Create or update tsconfig.json
  const tsconfigPath = join(cwd, "tsconfig.json");
  try {
    if (existsSync(tsconfigPath)) {
      // Read and merge existing config
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

      // Add/update Yama paths
      tsconfig.compilerOptions.paths = {
        ...tsconfig.compilerOptions.paths,
        "@gen/db": [".yama/gen/db"],
        "@gen/sdk": [".yama/gen/sdk"],
        "@gen/types": [".yama/gen/types.ts"],
      };

      writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
      console.log("✅ Updated tsconfig.json");
    } else {
      // Create new tsconfig.json
      const tsconfig = {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          baseUrl: ".",
          paths: {
            "@gen/db": [".yama/gen/db"],
            "@gen/sdk": [".yama/gen/sdk"],
            "@gen/types": [".yama/gen/types.ts"],
          },
        },
        include: [
          "src/**/*",
          ".yama/**/*",
        ],
        exclude: [
          "node_modules",
        ],
      };
      writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
      console.log("✅ Created tsconfig.json");
    }
  } catch (error) {
    console.log("⚠️  Could not update tsconfig.json:", error instanceof Error ? error.message : String(error));
  }

  // Update .gitignore
  const gitignorePath = join(cwd, ".gitignore");
  const gitignoreEntry = "\n# Yama generated files\n.yama/\n";

  if (existsSync(gitignorePath)) {
    const currentContent = readFileSync(gitignorePath, "utf-8");
    // Remove old entries if they exist
    const cleanedContent = currentContent
      .replace(/\n# Yama generated files\n.*generated\/.*\n/g, "")
      .replace(/\n\.yama\/\n/g, "");
    
    if (!cleanedContent.includes(".yama/")) {
      writeFileSync(gitignorePath, cleanedContent + gitignoreEntry, "utf-8");
      console.log("✅ Updated .gitignore");
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntry.trimStart(), "utf-8");
    console.log("✅ Created .gitignore");
  }

  console.log("\n✨ Yama project initialized!");
  console.log("\nNext steps:");
  console.log("  1. Install dependencies: npm install @betagors/yama-node");
  console.log("  2. Start dev server: yama dev");
  console.log("  3. Generate types: yama generate");
}

function getProjectName(cwd: string): string {
  try {
    const pkg = readPackageJson();
    if (pkg.name && typeof pkg.name === "string") {
      return pkg.name;
    }
  } catch {
    // Ignore
  }
  
  // Fallback to directory name
  return basename(cwd);
}

