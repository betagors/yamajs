import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { resolveEnvVars, loadEnvFile } from "@betagors/yama-core";
import { success, error, info, warning } from "../utils/cli-utils.ts";
import { loadPlugin } from "@betagors/yama-core";
import { table } from "table";

interface PluginHealthOptions {
  plugin?: string;
  config?: string;
  env?: string;
}

export async function pluginHealthCommand(
  options: PluginHealthOptions
): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    console.log("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    let config = readYamaConfig(configPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
    };
    config = resolveEnvVars(config) as typeof config;
    const configDir = getConfigDir(configPath);

    // Get plugins to check
    const pluginsToCheck: string[] = [];
    if (options.plugin) {
      pluginsToCheck.push(options.plugin);
    } else {
      if (config.plugins) {
        const pluginList = Array.isArray(config.plugins)
          ? config.plugins
          : Object.keys(config.plugins);
        pluginsToCheck.push(...pluginList);
      }
    }

    if (pluginsToCheck.length === 0) {
      info("No plugins configured");
      return;
    }

    const healthRows: string[][] = [
      ["Plugin", "Status", "Details", "Error"],
    ];

    for (const pluginName of pluginsToCheck) {
      try {
        const plugin = await loadPlugin(pluginName, configDir);

        if (!plugin.onHealthCheck) {
          healthRows.push([
            pluginName,
            "⚠️  No health check",
            "Health check not implemented",
            "",
          ]);
          continue;
        }

        try {
          const healthStatus = await plugin.onHealthCheck();
          const status = healthStatus.healthy ? "✅ Healthy" : "❌ Unhealthy";
          const details = healthStatus.details
            ? JSON.stringify(healthStatus.details, null, 2).substring(0, 50)
            : "";
          const errorMsg = healthStatus.error || "";

          healthRows.push([pluginName, status, details, errorMsg]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          healthRows.push([
            pluginName,
            "❌ Error",
            "",
            errorMsg.substring(0, 100),
          ]);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (
          errorMsg.includes("Cannot find module") ||
          errorMsg.includes("not found")
        ) {
          healthRows.push([
            pluginName,
            "❌ Not installed",
            "",
            "Plugin not found",
          ]);
        } else {
          healthRows.push([pluginName, "❌ Error", "", errorMsg.substring(0, 100)]);
        }
      }
    }


    // Fallback to text output
    console.log("\n🏥 Plugin Health Status\n");
    console.log(table(healthRows));

    // Summary
    const healthyCount = healthRows.filter((r) => r[1].includes("✅")).length - 1;
    const unhealthyCount = healthRows.filter((r) => r[1].includes("❌")).length - 1;
    const noCheckCount = healthRows.filter((r) => r[1].includes("⚠️")).length - 1;

    console.log("\n📊 Summary:");
    if (healthyCount > 0) {
      success(`Healthy: ${healthyCount} plugin(s)`);
    }
    if (unhealthyCount > 0) {
      error(`Unhealthy: ${unhealthyCount} plugin(s)`);
    }
    if (noCheckCount > 0) {
      warning(`No health check: ${noCheckCount} plugin(s)`);
    }

    // Exit with error code if any unhealthy
    if (unhealthyCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    error(`Failed to check plugin health: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}


