import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { readPackageJson, writePackageJson, ensureDir } from "../utils/file-utils.ts";
import { getYamaSchemaPath } from "../utils/paths.ts";
import { detectIDE, getIDEName } from "../utils/project-detection.ts";

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
    
    const hasRuntime = "@betagors/yama-node" in deps || "@betagors/yama-node" in devDeps;
    
    if (!hasRuntime) {
      console.log("\n⚠️  @betagors/yama-node not found in dependencies.");
      console.log("   Install it with: npm install @betagors/yama-node");
    } else {
      console.log("✅ Found @betagors/yama-node");
    }

    // Setup editor configuration (only for supported IDEs)
    if (!options.skipEditorConfig) {
      const detectedIDE = detectIDE(cwd);
      
      if (detectedIDE) {
        try {
          // Get schema path (use a dummy path to find the schema)
          const dummyYamlPath = join(cwd, "yama.yaml");
          const schemaPath = getYamaSchemaPath(dummyYamlPath);
          
          // VS Code and Cursor both use .vscode folder
          if (detectedIDE === "vscode" || detectedIDE === "cursor") {
            setupVSCodeSettings(cwd, schemaPath);
            console.log(`✅ Configured ${getIDEName(detectedIDE)} settings for Yama YAML autocomplete`);
          }
          
          // WebStorm/JetBrains uses .idea folder
          if (detectedIDE === "webstorm") {
            setupWebStormConfig(cwd, schemaPath);
            console.log(`✅ Configured ${getIDEName(detectedIDE)} JSON Schema mapping for Yama YAML autocomplete`);
          }
          
          // Setup YAML Language Server config (works for all IDEs)
          setupYamlLSConfig(cwd, schemaPath);
          console.log("✅ Created .yamlls-config.json for YAML Language Server");
          
          console.log("\n💡 Editor autocomplete is now configured for:");
          console.log("   - yama.yaml");
          console.log("   - yama.yml");
          console.log("   - *.yama.yaml");
          console.log("   - *.yama.yml");
          
          if (detectedIDE === "vscode" || detectedIDE === "cursor") {
            console.log(`\n📦 To enable autocomplete, install the YAML extension in ${getIDEName(detectedIDE)}:`);
            console.log("   1. Open Extensions (Ctrl+Shift+X)");
            console.log("   2. Search for 'YAML' by Red Hat");
            console.log(`   3. Install and reload ${getIDEName(detectedIDE)}`);
            const installCmd = detectedIDE === "cursor" 
              ? "cursor --install-extension redhat.vscode-yaml"
              : "code --install-extension redhat.vscode-yaml";
            console.log(`   Or run: ${installCmd}`);
          } else if (detectedIDE === "webstorm") {
            console.log(`\n✅ WebStorm has built-in YAML support!`);
            console.log(`   The schema is configured in .idea/jsonSchemas.xml`);
            console.log(`   You may need to restart WebStorm for changes to take effect.`);
          }
        } catch (error) {
          console.warn("⚠️  Failed to setup editor configuration:", error instanceof Error ? error.message : String(error));
          console.log("   You can manually configure it - see docs in node_modules/@betagors/yama-cli/src/editor-configs/");
        }
      } else {
        console.log("\n⚠️  No supported IDE detected (VS Code, Cursor, Zed, or WebStorm).");
        console.log("   Editor-specific configuration was skipped.");
        console.log("   Autocomplete will still work via the schema comment in yama.yaml");
        console.log("   if you have a YAML Language Server extension installed.");
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

