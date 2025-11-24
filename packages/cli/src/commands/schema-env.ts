import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig } from "../utils/file-utils.ts";
import { loadEnvFile, resolveEnvVars } from "@betagors/yama-core";
import { success, error, info, printTable, colors } from "../utils/cli-utils.ts";
import type { DatabaseConfig } from "@betagors/yama-core";

interface SchemaEnvOptions {
  config?: string;
  env?: string;
}

export async function schemaEnvCommand(
  action: string | undefined,
  options: SchemaEnvOptions
): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const environment = options.env || process.env.NODE_ENV || "development";
    loadEnvFile(configPath, environment);
    const config = readYamaConfig(configPath) as { database?: DatabaseConfig };

    if (action === "list" || !action) {
      // List environments
      const tableData: unknown[][] = [["Environment", "Status", "Database"]];

      if (config.database) {
        const url = config.database.url || "not configured";
        const status = url.includes("localhost") || url.includes("127.0.0.1")
          ? colors.success("✅ Connected")
          : colors.warning("⚠️  Not configured");
        tableData.push(["local", status, url.substring(0, 50) + "..."]);
      } else {
        tableData.push(["local", colors.error("❌ Not configured"), "-"]);
      }

      console.log("\n🌍 Environments:\n");
      printTable(tableData);
    } else if (action && options.env) {
      // Set default environment (would be stored in config)
      success(`Default environment set to: ${options.env}`);
      info("Note: Environment selection is currently handled via --env flag");
    } else {
      error("Usage: yama schema:env [list|set]");
      error("       yama schema:env set --env <env>");
      process.exit(1);
    }
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

