import { existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig, writeYamaConfig, readPackageJson } from "../utils/file-utils.ts";
import { success, error } from "../utils/cli-utils.ts";
import { detectPackageManager } from "../utils/project-detection.ts";
import { loadPlugin } from "@betagors/yama-core";

interface AddPluginOptions {
  config?: string;
  name?: string;
  configOnly?: boolean; // Only add to yama.yaml, don't install package
}

export async function addPluginCommand(options: AddPluginOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    console.log("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  if (!options.name) {
    error("Plugin name is required. Use --name <name> or -n <name>");
    process.exit(1);
  }

  const pluginName = options.name.trim();

  // Validate plugin name
  if (pluginName.length === 0) {
    error("Plugin name cannot be empty");
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
    };

    // Check if plugin already exists
    let pluginExists = false;
    if (config.plugins) {
      if (Array.isArray(config.plugins)) {
        pluginExists = config.plugins.includes(pluginName);
      } else {
        pluginExists = pluginName in config.plugins;
      }
    }

    if (pluginExists) {
      error(`Plugin "${pluginName}" is already configured in yama.yaml`);
      process.exit(1);
    }

    // Install the package if not config-only
    if (!options.configOnly) {
      console.log(`📦 Installing plugin: ${pluginName}`);
      const packageManager = detectPackageManager();
      const configDir = getConfigDir(configPath);
      
      try {
        execSync(`${packageManager} add ${pluginName}`, { 
          cwd: configDir, 
          stdio: "inherit" 
        });
        console.log(`✅ Package installed`);
        
        // Install peerDependencies if they exist
        try {
          // Try to find the plugin's package.json in node_modules
          const pluginPackagePath = join(configDir, "node_modules", pluginName, "package.json");
          if (existsSync(pluginPackagePath)) {
            const pluginPackage = readPackageJson(pluginPackagePath);
            const peerDeps = pluginPackage.peerDependencies as Record<string, string> | undefined;
            
            if (peerDeps && Object.keys(peerDeps).length > 0) {
              console.log(`📦 Installing peer dependencies...`);
              const peerDepList = Object.entries(peerDeps)
                .map(([name, version]) => `${name}@${version}`)
                .join(" ");
              
              try {
                execSync(`${packageManager} add ${peerDepList}`, {
                  cwd: configDir,
                  stdio: "inherit"
                });
                console.log(`✅ Peer dependencies installed`);
              } catch (peerErr) {
                console.warn(`⚠️  Failed to install some peer dependencies: ${peerErr instanceof Error ? peerErr.message : String(peerErr)}`);
                console.log(`   You may need to install them manually: ${peerDepList}`);
              }
            }
          }
        } catch (peerDepErr) {
          // Silently fail - peer dependencies check is optional
        }
      } catch (err) {
        error(`Failed to install package: ${err instanceof Error ? err.message : String(err)}`);
        console.log(`   You can add it to yama.yaml manually and install later`);
        process.exit(1);
      }

      // Validate the plugin
      try {
        console.log(`🔍 Validating plugin...`);
        await loadPlugin(pluginName, configDir);
        console.log(`✅ Plugin validated`);
      } catch (err) {
        console.warn(`⚠️  Plugin validation failed: ${err instanceof Error ? err.message : String(err)}`);
        console.log(`   Continuing anyway - plugin may still work`);
      }
    }

    // Add plugin to yama.yaml
    if (!config.plugins) {
      config.plugins = {};
    }

    // Convert array to object if needed
    if (Array.isArray(config.plugins)) {
      const pluginsObj: Record<string, Record<string, unknown>> = {};
      for (const plugin of config.plugins) {
        pluginsObj[plugin] = {};
      }
      config.plugins = pluginsObj;
    }

    // Add the new plugin with default config
    const pluginsObj = config.plugins as Record<string, Record<string, unknown>>;
    
    // Check if it's a database plugin and add default config
    if (pluginName.includes("postgres") || pluginName.includes("pglite")) {
      pluginsObj[pluginName] = {
        url: "${DATABASE_URL}"
      };
    } else {
      pluginsObj[pluginName] = {};
    }

    writeYamaConfig(configPath, config);
    success(`Plugin "${pluginName}" added to yama.yaml`);

    console.log("\n💡 Next steps:");
    if (options.configOnly) {
      console.log(`   1. Install the package: ${detectPackageManager()} add ${pluginName}`);
    }
    console.log(`   2. Configure the plugin in yama.yaml if needed`);
    console.log(`   3. Run 'yama generate' to update generated code`);
  } catch (err) {
    error(`Failed to add plugin: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

