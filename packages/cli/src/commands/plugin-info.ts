import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import { success, error, info } from "../utils/cli-utils.ts";
import { loadPluginFromPackage } from "@betagors/yama-core";
import { table } from "table";

interface PluginInfoOptions {
  package: string;
  config?: string;
}

interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  author?: string | { name: string; email?: string };
  license?: string;
  repository?: { url: string; type: string };
  homepage?: string;
  bugs?: { url: string };
  dist: {
    tarball: string;
  };
  "dist-tags": {
    latest: string;
  };
  time: {
    created: string;
    modified: string;
  };
  versions: Record<string, unknown>;
}

export async function pluginInfoCommand(
  options: PluginInfoOptions
): Promise<void> {
  try {
    const packageName = options.package;

    // Try to load plugin locally first
    const configPath = options.config || findYamaConfig() || "yama.yaml";
    const configDir = existsSync(configPath) ? getConfigDir(configPath) : process.cwd();

    let localManifest = null;
    try {
      localManifest = await loadPluginFromPackage(packageName, configDir);
    } catch {
      // Plugin not installed locally, continue to fetch from npm
    }

    // Fetch from npm registry
    info(`Fetching plugin information for ${packageName}...\n`);

    const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await fetch(registryUrl);

    if (!response.ok) {
      if (response.status === 404) {
        error(`Plugin ${packageName} not found on npm`);
        process.exit(1);
      }
      throw new Error(`npm registry request failed: ${response.statusText}`);
    }

    const pkgInfo = (await response.json()) as NpmPackageInfo;
    const latestVersion = pkgInfo["dist-tags"]?.latest || pkgInfo.version;

    const versions = Object.keys(pkgInfo.versions);
    const recentVersions = versions.slice(-10).reverse();
    
    const latestPkgVersion = pkgInfo.versions[latestVersion] as any;
    const yamaMetadata = latestPkgVersion?.yama;
    // Display plugin information
    console.log(`📦 ${pkgInfo.name}\n`);
    console.log(`Version: ${latestVersion}`);
    if (pkgInfo.description) {
      console.log(`Description: ${pkgInfo.description}`);
    }
    if (pkgInfo.homepage) {
      console.log(`Homepage: ${pkgInfo.homepage}`);
    }
    if (pkgInfo.repository?.url) {
      console.log(`Repository: ${pkgInfo.repository.url}`);
    }
    if (pkgInfo.license) {
      console.log(`License: ${pkgInfo.license}`);
    }

    // Show Yama-specific metadata if available
    if (yamaMetadata) {
      console.log(`\n🔌 Yama Plugin Metadata:`);
      if (yamaMetadata.category) {
        console.log(`  Category: ${yamaMetadata.category}`);
      }
      if (yamaMetadata.pluginApi) {
        console.log(`  Plugin API: ${yamaMetadata.pluginApi}`);
      }
      if (yamaMetadata.yamaCore) {
        console.log(`  Yama Core: ${yamaMetadata.yamaCore}`);
      }
      if (yamaMetadata.dependencies?.plugins) {
        console.log(`  Dependencies: ${yamaMetadata.dependencies.plugins.join(", ")}`);
      }
    }

    // Show local installation status
    if (localManifest) {
      success(`\n✅ Installed locally`);
      if (localManifest.yamaCore) {
        console.log(`   Compatible with Yama Core: ${localManifest.yamaCore}`);
      }
    } else {
      info(`\n📥 Not installed locally`);
      console.log(`   Install with: yama plugin install ${packageName}`);
    }

    // Show available versions
    console.log(`\n📋 Available Versions (showing last 10):`);
    const versionTableRows: string[][] = [["Version", "Published"]];
    for (const version of recentVersions) {
      const versionInfo = pkgInfo.versions[version] as any;
      const publishTime = versionInfo?.time || pkgInfo.time?.modified || "Unknown";
      versionTableRows.push([version, publishTime]);
    }
    console.log(table(versionTableRows));

    // Show download stats if available
    console.log(`\n📊 Package Info:`);
    console.log(`   Total versions: ${versions.length}`);
    console.log(`   Created: ${pkgInfo.time?.created || "Unknown"}`);
    console.log(`   Modified: ${pkgInfo.time?.modified || "Unknown"}`);
  } catch (err) {
    error(`Failed to get plugin info: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}


