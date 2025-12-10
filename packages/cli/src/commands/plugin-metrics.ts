import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { resolveEnvVars, loadEnvFile } from "@betagors/yama-core";
import { success, error, info } from "../utils/cli-utils.ts";
import { loadPlugin, setPluginRegistryConfig, pluginRegistry } from "@betagors/yama-core";
import {
  pluginMetricsCollector,
} from "@betagors/yama-core";
import { table } from "table";

interface PluginMetricsOptions {
  plugin?: string;
  config?: string;
  env?: string;
  reset?: boolean;
  format?: "table" | "prometheus" | "json";
}

export async function pluginMetricsCommand(
  options: PluginMetricsOptions
): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (options.reset) {
    pluginMetricsCollector.clearAllMetrics();
    success("Metrics cleared");
    return;
  }

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

    // Initialize plugin registry
    setPluginRegistryConfig(config, configDir);

    // Get plugin list
    const pluginList = config.plugins
      ? Array.isArray(config.plugins)
        ? config.plugins
        : Object.keys(config.plugins)
      : [];

    // Try to load metrics plugin first if available
    let metricsService: any = null;
    if (pluginList.includes("@betagors/yama-metrics")) {
      try {
        const metricsConfig = !config.plugins || Array.isArray(config.plugins)
          ? {}
          : (config.plugins["@betagors/yama-metrics"] || {});
        await loadPlugin("@betagors/yama-metrics", configDir, metricsConfig);
        metricsService = pluginRegistry.getPluginAPI("@betagors/yama-metrics");
      } catch (err) {
        // Metrics plugin not available, fall back to direct collector
        info("Metrics plugin not available, using direct collector");
      }
    }

    // Get plugins to show metrics for
    const pluginsToShow: string[] = [];
    if (options.plugin) {
      pluginsToShow.push(options.plugin);
    } else {
      pluginsToShow.push(...pluginList.filter((p) => p !== "@betagors/yama-metrics"));
    }

    // Load plugins to collect metrics
    for (const pluginName of pluginsToShow) {
      try {
        const pluginConfig = !config.plugins || Array.isArray(config.plugins)
          ? {}
          : (config.plugins[pluginName] || {});
        await loadPlugin(pluginName, configDir, pluginConfig);
      } catch (err) {
        // Ignore errors for metrics collection
      }
    }

    // Get summary - use metrics service if available, otherwise use collector
    const summary = metricsService
      ? metricsService.getSummary()
      : pluginMetricsCollector.getSummary();

    // Export format handling
    const format = options.format || "table";
    
    if (format === "prometheus" && metricsService) {
      console.log(metricsService.export("prometheus"));
      return;
    }
    
    if (format === "json") {
      const allMetrics = metricsService
        ? metricsService.getPluginMetrics()
        : pluginMetricsCollector.getAllMetrics();
      console.log(JSON.stringify({ summary, plugins: allMetrics }, null, 2));
      return;
    }


    // Fallback to text output
    console.log("\n📊 Plugin Metrics Summary\n");
    console.log(`Total Plugins: ${summary.totalPlugins}`);
    console.log(`Total Load Time: ${summary.totalLoadTime.toFixed(2)}ms`);
    console.log(`Total Init Time: ${summary.totalInitTime.toFixed(2)}ms`);
    console.log(`Average Load Time: ${summary.averageLoadTime.toFixed(2)}ms`);
    console.log(`Average Init Time: ${summary.averageInitTime.toFixed(2)}ms`);
    console.log(`Total API Calls: ${summary.totalAPICalls}`);
    console.log(`Total Errors: ${summary.totalErrors}`);

    // Show per-plugin metrics (table format)
    if (pluginsToShow.length > 0) {
      console.log("\n📦 Per-Plugin Metrics\n");
      const rows: string[][] = [
        ["Plugin", "Load (ms)", "Init (ms)", "API Calls", "Errors", "Last Error"],
      ];

      for (const pluginName of pluginsToShow) {
        const metrics = metricsService
          ? metricsService.getPluginMetrics(pluginName)
          : pluginMetricsCollector.getMetrics(pluginName);
        if (metrics) {
          rows.push([
            pluginName,
            metrics.loadTime.toFixed(2),
            metrics.initTime.toFixed(2),
            String(metrics.apiCalls),
            String(metrics.errors),
            metrics.lastError
              ? `${metrics.lastError.message.substring(0, 30)}...`
              : "",
          ]);
        } else {
          rows.push([pluginName, "N/A", "N/A", "0", "0", ""]);
        }
      }

      console.log(table(rows));
    }

    console.log("\n💡 Tip: Use --reset to clear metrics");
    console.log("💡 Tip: Use --format prometheus or --format json for export");
  } catch (err) {
    error(`Failed to get plugin metrics: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

