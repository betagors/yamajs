import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join, basename, resolve, dirname, relative } from "path";
import { execSync, spawn } from "child_process";
import inquirer from "inquirer";
import { ensureDir, readPackageJson, writePackageJson } from "../utils/file-utils.ts";
import { createSpinner, colors, printBox, success, error, warning, info } from "../utils/cli-utils.ts";
import { getYamaSchemaPath } from "../utils/paths.ts";

interface CreateOptions {
  name?: string;
  database?: string;
  yes?: boolean;
}

/**
 * Detect package manager from environment or lock files
 */
function detectPackageManager(cwd: string): "pnpm" | "npm" | "yarn" {
  // Check for packageManager field in package.json
  try {
    const pkgPath = join(cwd, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.packageManager) {
        if (pkg.packageManager.startsWith("pnpm")) return "pnpm";
        if (pkg.packageManager.startsWith("yarn")) return "yarn";
        if (pkg.packageManager.startsWith("npm")) return "npm";
      }
    }
  } catch {
    // Ignore
  }

  // Check for lock files
  if (existsSync(join(cwd, "pnpm-lock.yaml")) || existsSync(join(cwd, "pnpm-workspace.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  if (existsSync(join(cwd, "package-lock.json"))) {
    return "npm";
  }

  // Check parent directories for workspace
  let current = cwd;
  const root = resolve(current, "..", "..", "..");
  while (current !== root && current !== dirname(current)) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return "pnpm";
    }
    if (existsSync(join(current, "yarn.lock"))) {
      return "yarn";
    }
    current = dirname(current);
  }

  // Default to npm
  return "npm";
}

/**
 * Setup VS Code settings for Yama YAML autocomplete
 */
function setupVSCodeSettings(cwd: string, schemaPath: string): void {
  const vscodeDir = join(cwd, ".vscode");
  const settingsPath = join(vscodeDir, "settings.json");
  
  let settings: Record<string, unknown> = {};
  
  // Read existing settings if they exist
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, "utf-8");
      settings = JSON.parse(content);
    } catch {
      // If parsing fails, start fresh
      settings = {};
    }
  }
  
  // Ensure yaml.schemas exists
  if (!settings["yaml.schemas"]) {
    settings["yaml.schemas"] = {};
  }
  
  const yamlSchemas = settings["yaml.schemas"] as Record<string, string[]>;
  
  // Add Yama schema mapping
  yamlSchemas[schemaPath] = [
    "yama.yaml",
    "yama.yml",
    "*.yama.yaml",
    "*.yama.yml"
  ];
  
  // Write settings
  ensureDir(vscodeDir);
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * Setup YAML Language Server config
 */
function setupYamlLSConfig(cwd: string, schemaPath: string): void {
  const configPath = join(cwd, ".yamlls-config.json");
  
  const config = {
    yaml: {
      schemas: {
        [schemaPath]: [
          "yama.yaml",
          "yama.yml",
          "*.yama.yaml",
          "*.yama.yml"
        ]
      }
    }
  };
  
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Get project name from package.json or directory name
 */
function getProjectName(cwd: string): string {
  try {
    const pkg = readPackageJson(join(cwd, "package.json"));
    if (pkg.name && typeof pkg.name === "string") {
      return pkg.name;
    }
  } catch {
    // Ignore
  }
  
  // Fallback to directory name
  return basename(cwd);
}

/**
 * Create a new Yama project - works like Next.js create
 * - `yama create` -> prompt for name, create new directory
 * - `yama create .` -> create in current directory
 * - `yama create my-app` -> create in my-app directory
 */
export async function createCommand(projectName?: string, options: CreateOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const isNonInteractive = options.yes || false;
  
  // Handle `.` for current directory (like Next.js)
  const useCurrentDir = projectName === "." || projectName === "./";
  
  let finalProjectName: string;
  let projectPath: string;
  
  if (useCurrentDir) {
    // Use current directory
    projectPath = cwd;
    finalProjectName = getProjectName(cwd);
  } else {
    // Get project name
    finalProjectName = projectName || options.name || "";
    if (!finalProjectName) {
      if (isNonInteractive) {
        finalProjectName = "my-yama-app";
      } else {
        const answer = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "What is your project named?",
            default: "my-yama-app",
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return "Project name cannot be empty";
              }
              if (!/^[a-z0-9-_]+$/i.test(input)) {
                return "Project name can only contain letters, numbers, hyphens, and underscores";
              }
              return true;
            },
          },
        ]);
        finalProjectName = answer.name;
      }
    }

    if (!finalProjectName) {
      error("Project name is required");
      process.exit(1);
    }

    projectPath = join(cwd, finalProjectName);
    
    // Check if directory exists
    if (existsSync(projectPath)) {
      if (isNonInteractive) {
        error(`Directory ${finalProjectName} already exists. Use a different name.`);
        process.exit(1);
      }
      
      const answer = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: `Directory ${finalProjectName} already exists. Overwrite?`,
          default: false,
        },
      ]);
      if (!answer.overwrite) {
        error("Cancelled");
        process.exit(0);
      }
      // Remove existing directory
      rmSync(projectPath, { recursive: true, force: true });
    }
  }
  
  // Check if yama.yaml already exists (for current directory case)
  if (useCurrentDir) {
    const existingYaml = join(projectPath, "yama.yaml");
    if (existsSync(existingYaml)) {
      if (isNonInteractive) {
        error("yama.yaml already exists in current directory. Remove it first or use a different directory.");
        process.exit(1);
      }
      
      const answer = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: "yama.yaml already exists in current directory. Overwrite?",
          default: false,
        },
      ]);
      if (!answer.overwrite) {
        error("Cancelled");
        process.exit(0);
      }
    }
  }

  // Show welcome message
  console.log();
  printBox(
    `✨ Welcome to Yama!\n\nCreating your project: ${colors.bold(finalProjectName)}`,
    { borderColor: "cyan" }
  );
  console.log();

  // Ask about database and plugins
  // Default to "none" to avoid native compilation issues - users can add database later
  let databaseChoice = options.database;
  if (!databaseChoice && !isNonInteractive) {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "database",
        message: "Which database would you like to use?",
        choices: [
          { 
            name: "None (start simple, add database later)", 
            value: "none",
            short: "None"
          },
          { 
            name: "PGlite (in-memory PostgreSQL, no setup needed)", 
            value: "pglite",
            short: "PGlite"
          },
          { 
            name: "PostgreSQL (pure JS, no build tools needed)", 
            value: "postgresql",
            short: "PostgreSQL"
          },
        ],
        default: "none",
      },
    ]);
    databaseChoice = answer.database;
  } else if (!databaseChoice) {
    // Default to "none" in non-interactive mode to avoid complications
    databaseChoice = "none";
  }

  // Detect if we're in a workspace (for dependency resolution)
  const workspaceRootForProject = findWorkspaceRoot(projectPath);
  const isInWorkspace = workspaceRootForProject !== null;

  // Build plugins config
  const selectedPlugins: Record<string, Record<string, unknown>> = {};
  
  if (databaseChoice === "pglite") {
    selectedPlugins["@yama/pglite"] = {};
  } else if (databaseChoice === "postgresql") {
    selectedPlugins["@yama/postgres"] = {
      url: "${DATABASE_URL}"
    };
  }

  // Create project directory
  const spinner = createSpinner("Creating project structure...");
  try {
    mkdirSync(projectPath, { recursive: true });
    
    // Build dependencies list
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {};
    
    // Core dependencies
    if (isInWorkspace && workspaceRootForProject) {
      // Use file: protocol for workspace packages
      dependencies["@yama/core"] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", "core")).replace(/\\/g, "/")}`;
      dependencies["@yama/runtime-node"] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", "runtime-node")).replace(/\\/g, "/")}`;
      devDependencies["@yama/cli"] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", "cli")).replace(/\\/g, "/")}`;
    } else {
      dependencies["@yama/core"] = "latest";
      dependencies["@yama/runtime-node"] = "latest";
      devDependencies["@yama/cli"] = "latest";
    }
    
    // Add plugins
    for (const plugin of Object.keys(selectedPlugins)) {
      if (isInWorkspace && workspaceRootForProject) {
        const packageName = plugin.replace("@yama/", "");
        dependencies[plugin] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", packageName)).replace(/\\/g, "/")}`;
      } else {
        dependencies[plugin] = "latest";
      }
    }
    
    // Add native dependencies from plugins
    if (isInWorkspace && workspaceRootForProject) {
      for (const plugin of Object.keys(selectedPlugins)) {
        const packageName = plugin.replace("@yama/", "");
        const pluginPath = join(workspaceRootForProject, "packages", packageName);
        const pluginPackageJson = join(pluginPath, "package.json");
        if (existsSync(pluginPackageJson)) {
          try {
            const pluginPkg = JSON.parse(readFileSync(pluginPackageJson, "utf-8"));
            const pluginDeps = {
              ...(pluginPkg.dependencies || {}),
              ...(pluginPkg.optionalDependencies || {}),
            };
            // Common native dependencies
            const nativeModulePatterns = [
              "pg",
              "postgres",
              "mysql2",
              "oracledb",
              "tedious",
              "mongodb",
            ];
            for (const [dep, version] of Object.entries(pluginDeps)) {
              if (nativeModulePatterns.some(pattern => dep.includes(pattern))) {
                dependencies[dep] = version as string;
              }
            }
            // Add node-gyp as dev dependency for building native modules on Windows
            if (nativeModulePatterns.some(pattern => 
              Object.keys(pluginDeps).some(dep => dep.includes(pattern))
            )) {
              devDependencies["node-gyp"] = "latest";
            }
          } catch {
            // Ignore errors
          }
        }
      }
    }
    
    // Create package.json
    const packageManager = detectPackageManager(workspaceRootForProject || cwd);
    
    // Use node to directly run @yama/cli from node_modules
    // This works reliably after package installation creates the node_modules structure
    // Works for both workspace and non-workspace projects
    const yamaExec = "node node_modules/@yama/cli/dist/cli/src/cli.js";
    
    const packageJson: Record<string, unknown> = {
      name: finalProjectName,
      version: "0.1.0",
      type: "module",
      scripts: {
        yama: yamaExec, // Allows: pnpm yama <command>
        dev: yamaExec + " dev", // Use node directly to ensure yama is found
        build: yamaExec + " generate",
        start: yamaExec + " dev",
      },
    };
    
    if (Object.keys(dependencies).length > 0) {
      packageJson.dependencies = dependencies;
    }
    if (Object.keys(devDependencies).length > 0) {
      packageJson.devDependencies = devDependencies;
    }
    
    writeFileSync(join(projectPath, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
    spinner.succeed("Created project structure");
  } catch (err) {
    spinner.fail("Failed to create project structure");
    throw err;
  }

  // Create yama.yaml
  const yamlSpinner = createSpinner("Creating yama.yaml...");
  try {
    const yamaYamlPath = join(projectPath, "yama.yaml");
    const pluginsSection = Object.keys(selectedPlugins).length > 0 
      ? `\nplugins:\n${Object.entries(selectedPlugins).map(([name, config]) => {
          const configStr = Object.keys(config).length > 0
            ? `\n    ${Object.entries(config).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n    ")}`
            : "";
          return `  "${name}":${configStr}`;
        }).join("\n")}`
      : "";
    const yamlContent = `name: ${finalProjectName}
version: 0.1.0${pluginsSection}
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
    // Add schema reference for autocomplete
    const schemaPath = getYamaSchemaPath(yamaYamlPath);
    const yamlWithSchema = `# yaml-language-server: $schema=${schemaPath}
${yamlContent}`;
    writeFileSync(yamaYamlPath, yamlWithSchema);
    yamlSpinner.succeed("Created yama.yaml");
  } catch (err) {
    yamlSpinner.fail("Failed to create yama.yaml");
    throw err;
  }

  // Create directory structure
  const dirSpinner = createSpinner("Creating directories...");
  try {
    ensureDir(join(projectPath, "src", "handlers"));
    ensureDir(join(projectPath, ".yama"));
    dirSpinner.succeed("Created directories");
  } catch (err) {
    dirSpinner.fail("Failed to create directories");
    throw err;
  }

  // Create example handler
  const handlerSpinner = createSpinner("Creating example handler...");
  try {
    const handlerContent = `import type { HttpRequest, HttpResponse } from "@yama/core";
import type { Example } from "@yama/types";

export async function getExamples(
  request: HttpRequest,
  reply: HttpResponse
): Promise<Example> {
  return {
    id: "1",
    name: "Example 1"
  };
}
`;
    writeFileSync(join(projectPath, "src", "handlers", "getExamples.ts"), handlerContent);
    handlerSpinner.succeed("Created example handler");
  } catch (err) {
    handlerSpinner.fail("Failed to create example handler");
    throw err;
  }

  // Create .gitignore
  const gitignoreSpinner = createSpinner("Creating .gitignore...");
  try {
    const gitignoreContent = `# Yama generated files
.yama/

# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Database

# Logs
*.log
`;
    writeFileSync(join(projectPath, ".gitignore"), gitignoreContent);
    gitignoreSpinner.succeed("Created .gitignore");
  } catch (err) {
    gitignoreSpinner.fail("Failed to create .gitignore");
    throw err;
  }

  // Create .npmrc to prevent hoisting native dependencies in pnpm workspaces
  // This ensures native modules are installed and built in the project's node_modules
  if (isInWorkspace && detectPackageManager(workspaceRootForProject || cwd) === "pnpm") {
    const npmrcSpinner = createSpinner("Creating .npmrc...");
    try {
      const npmrcContent = `# Prevent hoisting native dependencies to workspace root
# This ensures native modules are built in the project's node_modules
# Exclude native modules from public hoisting
public-hoist-pattern[]=!*pg*
public-hoist-pattern[]=!*postgres*
shamefully-hoist=false
`;
      writeFileSync(join(projectPath, ".npmrc"), npmrcContent);
      npmrcSpinner.succeed("Created .npmrc");
    } catch (err) {
      npmrcSpinner.fail("Failed to create .npmrc");
      // Non-fatal, continue
    }
  }

  // Setup editor configuration for autocomplete
  const editorSpinner = createSpinner("Configuring editor autocomplete...");
  try {
    const yamaYamlPath = join(projectPath, "yama.yaml");
    const schemaPath = getYamaSchemaPath(yamaYamlPath);
    
    // Setup VS Code settings
    setupVSCodeSettings(projectPath, schemaPath);
    
    // Setup YAML Language Server config
    setupYamlLSConfig(projectPath, schemaPath);
    
    editorSpinner.succeed("Configured editor autocomplete");
  } catch (err) {
    editorSpinner.fail("Failed to configure editor (non-fatal)");
    // Non-fatal, continue
  }

  // Create README.md
  const readmeSpinner = createSpinner("Creating README.md...");
  try {
    const readmeContent = `# ${finalProjectName}

A Yama API project.

## Getting Started

\`\`\`bash
# Install dependencies
${detectPackageManager(workspaceRootForProject || cwd)} install

# Start development server
${detectPackageManager(workspaceRootForProject || cwd)} dev
\`\`\`

The server will start on [http://localhost:4000](http://localhost:4000).

## Project Structure

- \`yama.yaml\` - API configuration (schemas, endpoints, plugins)
- \`src/handlers/\` - Request handlers (your business logic)
- \`.yama/\` - Generated files (types, SDK)

## Available Scripts

- \`${detectPackageManager(workspaceRootForProject || cwd)} dev\` - Start development server with hot reload
- \`${detectPackageManager(workspaceRootForProject || cwd)} build\` - Generate types and SDK
- \`${detectPackageManager(workspaceRootForProject || cwd)} start\` - Start production server

## Learn More

- [Yama Documentation](https://github.com/betagors/yama)
- Edit \`yama.yaml\` to define your API schemas and endpoints
- Add handlers in \`src/handlers/\` to implement your business logic
`;
    writeFileSync(join(projectPath, "README.md"), readmeContent);
    readmeSpinner.succeed("Created README.md");
  } catch (err) {
    readmeSpinner.fail("Failed to create README.md");
    throw err;
  }

  // Note: We don't auto-install dependencies
  // Users should run `pnpm install` or `npm install` manually
  // This ensures native modules are built correctly with the .npmrc configuration
  // 
  // Important: For native dependencies to build correctly, users may need:
  // - Python (for node-gyp on Windows)
  // - Visual Studio Build Tools (for node-gyp on Windows)
  // - Or use a prebuilt binary if available

  // Success message
  console.log();
  printBox(
    `✨ ${colors.bold("Yama project created successfully!")}\n\n` +
    `Project: ${colors.cyan(finalProjectName)}\n` +
    `Database: ${colors.cyan(databaseChoice === "none" ? "None" : databaseChoice)}\n` +
    `Plugins: ${Object.keys(selectedPlugins).length > 0 ? colors.cyan(Object.keys(selectedPlugins).join(", ")) : colors.dim("None")}`,
    { borderColor: "green", padding: 1 }
  );
  console.log();

  // Next steps - always show install step
  const packageManager = detectPackageManager(workspaceRootForProject || cwd);
  
  info("Next steps:");
  console.log(colors.dim(`   1. cd ${finalProjectName}`));
  console.log(colors.dim(`   2. ${packageManager} install`));
  
  // Note about workspace installs
  if (isInWorkspace) {
    console.log(colors.dim(`      Note: If you're in a workspace, run install from the project directory`));
    console.log(colors.dim(`      to avoid installing workspace package dependencies.`));
  }
  
  console.log(colors.dim(`   3. ${packageManager} dev`));
  if (databaseChoice === "none") {
    console.log();
    info("💡 Tip: Add a database later with:");
    console.log(colors.dim(`   yama plugin install @yama/pglite     # In-memory, no setup needed`));
    console.log(colors.dim(`   yama plugin install @yama/postgres   # Pure JS PostgreSQL`));
  }
  console.log();
}

/**
 * Find workspace root by looking for pnpm-workspace.yaml
 */
function findWorkspaceRoot(startDir: string): string | null {
  let current = startDir;
  const root = resolve(current, "..", "..", "..");
  
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


