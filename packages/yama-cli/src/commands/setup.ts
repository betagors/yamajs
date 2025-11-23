import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { readPackageJson, writePackageJson, ensureDir } from "../utils/file-utils.js";
import { getYamaSchemaPath } from "../utils/paths.js";

interface SetupOptions {
  skipScripts?: boolean;
  skipEditorConfig?: boolean;
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

export async function setupCommand(options: SetupOptions): Promise<void> {
  const cwd = process.cwd();
  const packageJsonPath = join(cwd, "package.json");

  console.log("🔧 Setting up Yama in existing project...\n");

  if (!existsSync(packageJsonPath)) {
    console.error("❌ package.json not found. Run 'npm init' first.");
    process.exit(1);
  }

  try {
    const pkg = readPackageJson(packageJsonPath);
    
    // Add scripts
    if (!options.skipScripts) {
      if (!pkg.scripts) {
        pkg.scripts = {};
      }
      
      const scripts = pkg.scripts as Record<string, string>;
      scripts["yama:dev"] = "yama dev";
      scripts["yama:generate"] = "yama generate";
      scripts["yama:validate"] = "yama validate";
      
      writePackageJson(packageJsonPath, pkg);
      console.log("✅ Added scripts to package.json");
    }

    // Check for yama.yaml
    const yamaPath = join(cwd, "yama.yaml");
    if (!existsSync(yamaPath)) {
      console.log("⚠️  yama.yaml not found. Run 'yama init' to create one.");
    } else {
      console.log("✅ Found yama.yaml");
    }

    // Check for dependencies
    const deps = (pkg.dependencies || {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies || {}) as Record<string, string>;
    
    const hasRuntime = "@yama/runtime-node" in deps || "@yama/runtime-node" in devDeps;
    
    if (!hasRuntime) {
      console.log("\n⚠️  @yama/runtime-node not found in dependencies.");
      console.log("   Install it with: npm install @yama/runtime-node");
    } else {
      console.log("✅ Found @yama/runtime-node");
    }

    // Setup editor configuration
    if (!options.skipEditorConfig) {
      try {
        // Get schema path (use a dummy path to find the schema)
        const dummyYamlPath = join(cwd, "yama.yaml");
        const schemaPath = getYamaSchemaPath(dummyYamlPath);
        
        // Setup VS Code settings
        setupVSCodeSettings(cwd, schemaPath);
        console.log("✅ Configured VS Code settings for Yama YAML autocomplete");
        
        // Setup YAML Language Server config
        setupYamlLSConfig(cwd, schemaPath);
        console.log("✅ Created .yamlls-config.json for YAML Language Server");
        
        console.log("\n💡 Editor autocomplete is now configured for:");
        console.log("   - yama.yaml");
        console.log("   - yama.yml");
        console.log("   - *.yama.yaml");
        console.log("   - *.yama.yml");
      } catch (error) {
        console.warn("⚠️  Failed to setup editor configuration:", error instanceof Error ? error.message : String(error));
        console.log("   You can manually configure it - see docs in node_modules/@yama/yama-cli/src/editor-configs/");
      }
    }

    console.log("\n✨ Setup complete!");
    console.log("\nAvailable commands:");
    console.log("  npm run yama:dev       - Start dev server");
    console.log("  npm run yama:generate  - Generate SDK/types");
    console.log("  npm run yama:validate  - Validate yama.yaml");
    
  } catch (error) {
    console.error("❌ Setup failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

