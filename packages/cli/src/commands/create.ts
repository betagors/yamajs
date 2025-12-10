import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join, basename, resolve, dirname, relative } from "path";
import { execSync, spawn } from "child_process";
import inquirer from "inquirer";
import { ensureDir, readPackageJson, writePackageJson } from "../utils/file-utils.ts";
import { createSpinner, colors, printBox, success, error, warning, info } from "../utils/cli-utils.ts";
import { getYamaSchemaPath } from "../utils/paths.ts";
import { detectIDE, getIDEName } from "../utils/project-detection.ts";

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
  let hasExistingSettings = false;
  
  // Read existing settings if they exist
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, "utf-8");
      settings = JSON.parse(content);
      hasExistingSettings = true;
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
  
  // Add helpful settings for YAML editing
  settings["yaml.validate"] = true;
  settings["yaml.hover"] = true;
  settings["yaml.completion"] = true;
  settings["files.associations"] = {
    ...(settings["files.associations"] as Record<string, string> || {}),
    "yama.yaml": "yaml",
    "yama.yml": "yaml"
  };
  
  // Write settings with comment header if it's a new file
  ensureDir(vscodeDir);
  let settingsContent = JSON.stringify(settings, null, 2) + "\n";
  
  if (!hasExistingSettings) {
    // Add helpful comments at the top
    // Note: This config works for both VS Code and Cursor (they share .vscode folder)
    settingsContent = `{
  // Yama YAML autocomplete configuration
  // Works with VS Code and Cursor (both use .vscode folder)
  // 
  // 📦 Required Extension: Install "YAML" by Red Hat (redhat.vscode-yaml)
  //    - Open Extensions (Ctrl+Shift+X) and search for "YAML"
  //    - Or install via command:
  //      VS Code: code --install-extension redhat.vscode-yaml
  //      Cursor:  cursor --install-extension redhat.vscode-yaml
  //
  // After installing, reload your editor (Ctrl+Shift+P -> "Reload Window")
  // Then you'll get autocomplete, validation, and hover docs for yama.yaml files!
  //
${settingsContent.slice(1)}`;
  }
  
  writeFileSync(settingsPath, settingsContent, "utf-8");
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
 * Setup WebStorm/JetBrains IDE JSON Schema configuration
 * Creates .idea/jsonSchemas.xml for YAML schema mapping
 */
function setupWebStormConfig(cwd: string, schemaPath: string): void {
  const ideaDir = join(cwd, ".idea");
  const schemasPath = join(ideaDir, "jsonSchemas.xml");
  
  // Convert relative path to absolute for WebStorm
  const absoluteSchemaPath = resolve(cwd, schemaPath).replace(/\\/g, "/");
  
  // Check if jsonSchemas.xml already exists
  let existingContent = "";
  if (existsSync(schemasPath)) {
    try {
      existingContent = readFileSync(schemasPath, "utf-8");
      // Check if Yama schema is already configured
      if (existingContent.includes("Yama Configuration Schema") || 
          existingContent.includes("yama.schema.json")) {
        // Already configured, skip
        return;
      }
    } catch {
      // If we can't read it, we'll create a new one
      existingContent = "";
    }
  }
  
  // Create .idea directory if it doesn't exist
  ensureDir(ideaDir);
  
  // Create or update jsonSchemas.xml
  // WebStorm uses XML format for JSON schema mappings
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="JsonSchemaMappingsProjectConfiguration">
    <state>
      <map>
        <entry key="Yama Configuration Schema">
          <value>
            <JsonSchemaMapping>
              <name>Yama Configuration Schema</name>
              <source>
                <file url="file://${absoluteSchemaPath}" />
              </source>
              <path>
                <pathitem name="yama.yaml" />
                <pathitem name="yama.yml" />
                <pathitem name="*.yama.yaml" />
                <pathitem name="*.yama.yml" />
              </path>
              <version>JSON Schema version 7</version>
            </JsonSchemaMapping>
          </value>
        </entry>
      </map>
    </state>
  </component>
</project>
`;
  
  // If there's existing content, we should merge it, but for simplicity,
  // we'll append our schema (WebStorm will handle duplicates)
  if (existingContent && !existingContent.includes("Yama Configuration Schema")) {
    // Try to insert before closing </project> tag
    const insertPos = existingContent.lastIndexOf("</project>");
    if (insertPos > 0) {
      const beforeClosing = existingContent.substring(0, insertPos);
      const afterClosing = existingContent.substring(insertPos);
      // Extract the entry from our template
      const entryMatch = xmlContent.match(/<entry key="Yama Configuration Schema">[\s\S]*?<\/entry>/);
      if (entryMatch) {
        // Find the map tag and insert before it closes
        const mapClosePos = beforeClosing.lastIndexOf("</map>");
        if (mapClosePos > 0) {
          const newContent = beforeClosing.substring(0, mapClosePos) + 
                           "\n        " + entryMatch[0] + "\n      " +
                           beforeClosing.substring(mapClosePos) + afterClosing;
          writeFileSync(schemasPath, newContent, "utf-8");
          return;
        }
      }
    }
  }
  
  // Write new file or overwrite if we couldn't merge
  writeFileSync(schemasPath, xmlContent, "utf-8");
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
  
  // Check if we need prompts (only for interactive mode, not for current dir)
  const needsPrompts = !useCurrentDir && !projectName && !isNonInteractive && !options.database;
  
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
    selectedPlugins["@betagors/yama-pglite"] = {};
  } else if (databaseChoice === "postgresql") {
    selectedPlugins["@betagors/yama-postgres"] = {
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
      dependencies["@betagors/yama-core"] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", "core")).replace(/\\/g, "/")}`;
      dependencies["@betagors/yama-node"] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", "node")).replace(/\\/g, "/")}`;
      devDependencies["@betagors/yama-cli"] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", "cli")).replace(/\\/g, "/")}`;
    } else {
      dependencies["@betagors/yama-core"] = "latest";
      dependencies["@betagors/yama-node"] = "latest";
      // Note: @betagors/yama-cli should be installed globally, not as a project dependency
      // Users should run: npm install -g @betagors/yama-cli (once published)
      // Or use: npx @betagors/yama-cli <command>
    }
    
    // Add plugins
    for (const plugin of Object.keys(selectedPlugins)) {
      if (isInWorkspace && workspaceRootForProject) {
        const packageName = plugin.replace("@betagors/yama-", "");
        dependencies[plugin] = `file:${relative(projectPath, join(workspaceRootForProject, "packages", packageName)).replace(/\\/g, "/")}`;
      } else {
        dependencies[plugin] = "latest";
      }
    }
    
    // Add native dependencies from plugins
    if (isInWorkspace && workspaceRootForProject) {
      for (const plugin of Object.keys(selectedPlugins)) {
        const packageName = plugin.replace("@betagors/yama-", "");
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
          } catch {
            // Ignore errors
          }
        }
      }
    }
    
    // Create package.json
    const packageManager = detectPackageManager(workspaceRootForProject || cwd);
    
    // Use node to directly run @betagors/yama-cli from node_modules
    // This works reliably after package installation creates the node_modules structure
    // Works for both workspace and non-workspace projects
    const yamaExec = "yama";
    
    const packageJson: Record<string, unknown> = {
      name: finalProjectName,
      version: "0.1.0",
      type: "module",
      exports: {
        "@gen/db": "./.yama/gen/db/index.ts",
        "@gen/types": "./.yama/gen/types.ts",
        "@gen/sdk": "./.yama/gen/sdk/index.ts",
      },
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
    
    // Create tsconfig.json
    const tsconfigPath = join(projectPath, "tsconfig.json");
    if (!existsSync(tsconfigPath)) {
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
    }
    
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
entities:
  Example:
    fields:
      id: uuid!
      name: string!
      createdAt: timestamp
      updatedAt: timestamp

endpoints:
  - path: /examples
    method: GET
    handler: src/handlers/getExamples.ts
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
    const handlerContent = `import type { GetExamplesHandlerContext, Example } from "@yama/gen";

export async function getExamples(
  context: GetExamplesHandlerContext
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

  // Setup editor configuration for autocomplete (only for supported IDEs)
  const detectedIDE = detectIDE(projectPath);
  if (detectedIDE) {
    const editorSpinner = createSpinner(`Configuring ${getIDEName(detectedIDE)} autocomplete...`);
    try {
      const yamaYamlPath = join(projectPath, "yama.yaml");
      const schemaPath = getYamaSchemaPath(yamaYamlPath);
      
      // VS Code and Cursor both use .vscode folder
      if (detectedIDE === "vscode" || detectedIDE === "cursor") {
        setupVSCodeSettings(projectPath, schemaPath);
      }
      
      // WebStorm/JetBrains uses .idea folder
      if (detectedIDE === "webstorm") {
        setupWebStormConfig(projectPath, schemaPath);
      }
      
      // Zed uses .zed folder (if we add Zed support later)
      // if (detectedIDE === "zed") {
      //   setupZedSettings(projectPath, schemaPath);
      // }
      
      // Setup YAML Language Server config (works for all IDEs)
      setupYamlLSConfig(projectPath, schemaPath);
      
      editorSpinner.succeed(`Configured ${getIDEName(detectedIDE)} autocomplete`);
    } catch (err) {
      editorSpinner.fail("Failed to configure editor (non-fatal)");
      // Non-fatal, continue
    }
    
    // Show editor setup instructions
    console.log();
    info(`📝 Editor Setup (${getIDEName(detectedIDE)}):`);
    console.log(colors.dim(`   Autocomplete is configured!`));
    
    if (detectedIDE === "vscode" || detectedIDE === "cursor") {
      console.log(colors.warning(`   ⚠️  Don't forget to install the YAML extension:`));
      console.log(colors.dim(`     1. Open Extensions (Ctrl+Shift+X)`));
      console.log(colors.dim(`     2. Search for "YAML" by Red Hat`));
      console.log(colors.dim(`     3. Install and reload ${getIDEName(detectedIDE)}`));
      const installCmd = detectedIDE === "cursor" 
        ? "cursor --install-extension redhat.vscode-yaml"
        : "code --install-extension redhat.vscode-yaml";
      console.log(colors.dim(`   Or run: ${installCmd}`));
    } else if (detectedIDE === "webstorm") {
      console.log(colors.dim(`   ✅ WebStorm has built-in YAML support!`));
      console.log(colors.dim(`   The schema is configured in .idea/jsonSchemas.xml`));
      console.log(colors.dim(`   You may need to restart WebStorm for changes to take effect.`));
    }
  } else {
    // No supported IDE detected
    console.log();
    warning("📝 Editor Setup:");
    console.log(colors.dim(`   No supported IDE detected (VS Code, Cursor, Zed, or WebStorm).`));
    console.log(colors.dim(`   Autocomplete will still work via the schema comment in yama.yaml`));
    console.log(colors.dim(`   if you have a YAML Language Server extension installed.`));
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

- [Yama Documentation](https://yamajs.org)
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
  // Note: Modern package managers (npm/pnpm/yarn) automatically handle native module
  // compilation. Build tools (Python, Visual Studio Build Tools) are only needed
  // if prebuilt binaries aren't available for the user's platform.

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
  
  // Note about CLI installation
  if (!isInWorkspace) {
    console.log(colors.dim(`   2. Install Yama CLI globally: npm install -g @betagors/yama-cli`));
    console.log(colors.dim(`      (Or use: npx @betagors/yama-cli <command> for each command)`));
    console.log(colors.dim(`   3. ${packageManager} install`));
    console.log(colors.dim(`   4. ${packageManager} dev`));
  } else {
    console.log(colors.dim(`   2. ${packageManager} install`));
    console.log(colors.dim(`      Note: If you're in a workspace, run install from the project directory`));
    console.log(colors.dim(`      to avoid installing workspace package dependencies.`));
    console.log(colors.dim(`   3. ${packageManager} dev`));
  }
  if (databaseChoice === "none") {
    console.log();
    info("💡 Tip: Add a database later with:");
    console.log(colors.dim(`   yama plugin install @betagors/yama-pglite     # In-memory, no setup needed`));
    console.log(colors.dim(`   yama plugin install @betagors/yama-postgres   # Pure JS PostgreSQL`));
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


