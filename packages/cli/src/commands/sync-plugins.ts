import { existsSync } from "fs";
import { execSync } from "child_process";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig, readPackageJson, writePackageJson } from "../utils/file-utils.ts";
import { success, error } from "../utils/cli-utils.ts";
import { detectPackageManager } from "../utils/project-detection.ts";
import { loadPlugin } from "@yamajs/core";

interface SyncPluginsOptions {
  config?: string;
  remove?: boolean; // Remove packages not in yama.yaml
}

export async function syncPluginsCommand(options: SyncPluginsOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    console.log("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
    };
    const configDir = getConfigDir(configPath);
    const packageJsonPath = `${configDir}/package.json`;

    if (!existsSync(packageJsonPath)) {
      error(`package.json not found in ${configDir}`);
      process.exit(1);
    }

    const pkg = readPackageJson(packageJsonPath);
    const allDeps = {
      ...((pkg.dependencies || {}) as Record<string, string>),
      ...((pkg.devDependencies || {}) as Record<string, string>),
    };

    // Get plugins from yama.yaml
    const yamaPlugins: string[] = [];
    if (config.plugins) {
      if (Array.isArray(config.plugins)) {
        yamaPlugins.push(...config.plugins);
      } else {
        yamaPlugins.push(...Object.keys(config.plugins));
      }
    }

    if (yamaPlugins.length === 0) {
      console.log("â„¹ï¸  No plugins configured in yama.yaml");
      return;
    }

    console.log(`ðŸ“¦ Syncing plugins from yama.yaml...\n`);
    console.log(`   Found ${yamaPlugins.length} plugin(s) in yama.yaml:\n`);
    yamaPlugins.forEach(plugin => {
      console.log(`   - ${plugin}`);
    });
    console.log();

    const packageManager = detectPackageManager();
    let installedCount = 0;
    let removedCount = 0;

    // Install missing plugins
    const missingPlugins: string[] = [];
    for (const pluginName of yamaPlugins) {
      if (!(pluginName in allDeps)) {
        missingPlugins.push(pluginName);
      }
    }

    if (missingPlugins.length > 0) {
      console.log(`ðŸ“¥ Installing ${missingPlugins.length} missing plugin(s)...\n`);
      for (const pluginName of missingPlugins) {
        try {
          console.log(`   Installing ${pluginName}...`);
          execSync(`${packageManager} add ${pluginName}`, {
            cwd: configDir,
            stdio: "inherit"
          });

          // Validate the plugin
          try {
            await loadPlugin(pluginName, configDir);
            console.log(`   âœ… ${pluginName} installed and validated`);
          } catch (err) {
            console.warn(`   âš ï¸  ${pluginName} installed but validation failed: ${err instanceof Error ? err.message : String(err)}`);
          }

          installedCount++;
        } catch (err) {
          error(`   âŒ Failed to install ${pluginName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.log();
    } else {
      console.log(`âœ… All plugins from yama.yaml are already installed\n`);
    }

    // Remove plugins not in yama.yaml (if --remove flag is set)
    if (options.remove) {
      // Find Yama plugins in package.json that are not in yama.yaml
      const pluginsToRemove: string[] = [];
      
      for (const [packageName] of Object.entries(allDeps)) {
        // Check if it's a Yama plugin (starts with @yamajs/ or @yamajs/)
        if (packageName.startsWith("@yamajs/") || packageName.startsWith("@yamajs/")) {
          if (!yamaPlugins.includes(packageName)) {
            pluginsToRemove.push(packageName);
          }
        }
      }

      if (pluginsToRemove.length > 0) {
        console.log(`ðŸ—‘ï¸  Removing ${pluginsToRemove.length} plugin(s) not in yama.yaml...\n`);
        for (const pluginName of pluginsToRemove) {
          try {
            console.log(`   Removing ${pluginName}...`);
            execSync(`${packageManager} remove ${pluginName}`, {
              cwd: configDir,
              stdio: "inherit"
            });
            console.log(`   âœ… ${pluginName} removed`);
            removedCount++;
          } catch (err) {
            console.warn(`   âš ï¸  Failed to remove ${pluginName}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        console.log();
      } else {
        console.log(`âœ… No plugins to remove\n`);
      }
    }

    // Summary
    console.log("ðŸ“Š Summary:");
    if (installedCount > 0) {
      console.log(`   âœ… Installed: ${installedCount} plugin(s)`);
    }
    if (options.remove && removedCount > 0) {
      console.log(`   ðŸ—‘ï¸  Removed: ${removedCount} plugin(s)`);
    }
    if (installedCount === 0 && (!options.remove || removedCount === 0)) {
      console.log(`   âœ… Everything is in sync!`);
    }

    console.log("\nðŸ’¡ Next steps:");
    console.log(`   Run 'yama generate' to update generated code`);
  } catch (err) {
    error(`Failed to sync plugins: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

