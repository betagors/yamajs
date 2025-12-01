import { execSync } from "child_process";
import { readPackageJson } from "../utils/file-utils.ts";
import { loadPluginFromPackage } from "@betagors/yama-core";

interface PluginOptions {
  package?: string;
}

/**
 * List installed service plugins
 */
export async function pluginListCommand(): Promise<void> {
  try {
    const pkg = readPackageJson();
    const deps = {
      ...((pkg.dependencies || {}) as Record<string, string>),
      ...((pkg.devDependencies || {}) as Record<string, string>),
    };

    const plugins: Array<{ name: string; version: string; manifest?: unknown }> = [];

    for (const [packageName, version] of Object.entries(deps)) {
      try {
        const manifest = await loadPluginFromPackage(packageName);
        plugins.push({
          name: packageName,
          version,
          manifest,
        });
      } catch {
        // Not a Yama plugin, skip
      }
    }

    console.log("📦 Installed Yama service plugins:\n");

    if (plugins.length === 0) {
      console.log("  No service plugins installed.");
      console.log("\n💡 Install a plugin with: yama plugin install <package-name>");
      return;
    }

    for (const plugin of plugins) {
      console.log(`  ✅ ${plugin.name}@${plugin.version}`);
      if (plugin.manifest) {
        const manifest = plugin.manifest as { type?: string; service?: string };
        if (manifest.type) {
          console.log(`     Type: ${manifest.type}`);
        }
        if (manifest.service) {
          console.log(`     Service: ${manifest.service}`);
        }
      }
      console.log();
    }
  } catch (error) {
    console.error("❌ Failed to list plugins:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Install a service plugin
 */
export async function pluginInstallCommand(options: PluginOptions): Promise<void> {
  const packageName = options.package;

  if (!packageName) {
    console.error("❌ Package name required");
    console.error("   Usage: yama plugin install <package-name>");
    process.exit(1);
  }

  console.log(`📦 Installing service plugin: ${packageName}\n`);

  try {
    // Install the package
    console.log("Installing npm package...");
    execSync(`npm install ${packageName}`, { stdio: "inherit" });

    // Try to load and validate the plugin
    console.log("\nValidating plugin...");
    const manifest = await loadPluginFromPackage(packageName);

    console.log(`\n✅ Plugin installed successfully!`);
    console.log(`   Name: ${manifest.name || packageName}`);
    console.log(`   Version: ${manifest.version || "unknown"}`);
    console.log(`   Type: ${manifest.type}`);
    if (manifest.service) {
      console.log(`   Service: ${manifest.service}`);
    }
    console.log("\n💡 Configure the plugin in your yama.yaml file");
  } catch (error) {
    console.error(`\n❌ Failed to install plugin: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Validate all installed service plugins
 */
export async function pluginValidateCommand(): Promise<void> {
  try {
    const pkg = readPackageJson();
    const deps = {
      ...((pkg.dependencies || {}) as Record<string, string>),
      ...((pkg.devDependencies || {}) as Record<string, string>),
    };

    const results: Array<{ plugin: string; valid: boolean; error?: string }> = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const [packageName] of Object.entries(deps)) {
      try {
        await loadPluginFromPackage(packageName);
        results.push({ plugin: packageName, valid: true });
        validCount++;
      } catch (error) {
        // Check if it's a Yama plugin that failed validation
        const errorMsg = error instanceof Error ? error.message : String(error);
        // If error mentions "Cannot find module", it's not a Yama plugin
        if (errorMsg.includes("Cannot find module") || errorMsg.includes("not found")) {
          // Not a Yama plugin, skip
        } else {
          // It's a Yama plugin but failed validation
          results.push({ plugin: packageName, valid: false, error: errorMsg });
          invalidCount++;
        }
      }
    }


    // Fallback to text output
    console.log("🔍 Validating service plugins...\n");

    for (const result of results) {
      if (result.valid) {
        console.log(`✅ ${result.plugin} - Valid`);
      } else {
        console.log(`❌ ${result.plugin} - Invalid: ${result.error || "Unknown error"}`);
      }
    }

    console.log(`\n📊 Results: ${validCount} valid, ${invalidCount} invalid`);

    if (invalidCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Failed to validate plugins:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

