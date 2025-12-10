import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig, writeYamaConfig } from "../utils/file-utils.ts";
import { success, error, info } from "../utils/cli-utils.ts";
import { loadPluginFromPackage } from "@betagors/yama-core";

interface PluginConfigureOptions {
  config?: string;
  plugin: string;
  settings?: Record<string, unknown>; // Optional: specific settings to configure
  interactive?: boolean; // Whether to show interactive prompts
}

interface PluginConfigInfo {
  plugin: string;
  currentConfig: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  recommendedConfig: Record<string, unknown>;
  requiredFields: string[];
  optionalFields: string[];
  examples: Record<string, unknown>[];
}

/**
 * Get configuration information for a plugin
 */
export async function pluginConfigureCommand(
  options: PluginConfigureOptions
): Promise<PluginConfigInfo> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    throw new Error(`Config file not found: ${configPath}`);
  }

  const config = readYamaConfig(configPath) as {
    plugins?: Record<string, Record<string, unknown>> | string[];
  };

  const configDir = getConfigDir(configPath);

  // Get current plugin config
  let currentConfig: Record<string, unknown> = {};
  if (config.plugins) {
    if (typeof config.plugins === "object" && !Array.isArray(config.plugins)) {
      currentConfig = config.plugins[options.plugin] || {};
    }
  }

  // Try to load plugin manifest to get config schema
  let configSchema: Record<string, unknown> | undefined;
  let recommendedConfig: Record<string, unknown> = {};
  const requiredFields: string[] = [];
  const optionalFields: string[] = [];
  const examples: Record<string, unknown>[] = [];

  try {
    const manifest = await loadPluginFromPackage(options.plugin, configDir);
    configSchema = manifest.configSchema;

    // Extract required/optional fields from schema
    if (configSchema && typeof configSchema === "object" && "properties" in configSchema) {
      const properties = (configSchema.properties as Record<string, any>) || {};
      const required = (configSchema.required as string[]) || [];

      for (const [key, value] of Object.entries(properties)) {
        if (required.includes(key)) {
          requiredFields.push(key);
        } else {
          optionalFields.push(key);
        }

        // Generate recommended config based on schema
        if (value.type === "string" && value.default === undefined) {
          if (key.toLowerCase().includes("url") || key.toLowerCase().includes("endpoint")) {
            recommendedConfig[key] = `\${${key.toUpperCase()}}`;
          } else if (key.toLowerCase().includes("host")) {
            recommendedConfig[key] = `\${${key.toUpperCase()}}`;
          } else if (key.toLowerCase().includes("port")) {
            recommendedConfig[key] = value.default || 5432;
          } else {
            recommendedConfig[key] = value.default || `\${${key.toUpperCase()}}`;
          }
        } else if (value.default !== undefined) {
          recommendedConfig[key] = value.default;
        }
      }
    }

    // Plugin-specific default configs
    if (options.plugin.includes("postgres") || options.plugin.includes("pglite")) {
      recommendedConfig = {
        url: "${DATABASE_URL}",
        ...recommendedConfig,
      };
      examples.push({
        url: "${DATABASE_URL}",
      });
      examples.push({
        url: "postgresql://user:password@localhost:5432/dbname",
      });
    } else if (options.plugin.includes("smtp")) {
      recommendedConfig = {
        host: "${SMTP_HOST}",
        port: 587,
        secure: true,
        auth: {
          user: "${SMTP_USER}",
          pass: "${SMTP_PASSWORD}",
        },
        ...recommendedConfig,
      };
      examples.push({
        host: "smtp.sendgrid.net",
        port: 587,
        secure: true,
        auth: {
          user: "apikey",
          pass: "${SENDGRID_API_KEY}",
        },
      });
    } else if (options.plugin.includes("s3")) {
      recommendedConfig = {
        endpoint: "${S3_ENDPOINT}",
        region: "${S3_REGION}",
        credentials: {
          accessKeyId: "${S3_ACCESS_KEY}",
          secretAccessKey: "${S3_SECRET_KEY}",
        },
        ...recommendedConfig,
      };
      examples.push({
        endpoint: "https://s3.amazonaws.com",
        region: "us-east-1",
        credentials: {
          accessKeyId: "${AWS_ACCESS_KEY_ID}",
          secretAccessKey: "${AWS_SECRET_ACCESS_KEY}",
        },
      });
    }
  } catch (err) {
    // Plugin not installed or can't be loaded, that's okay
    info(`Could not load plugin manifest: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Merge current config with recommended
  recommendedConfig = { ...recommendedConfig, ...currentConfig };

  // If specific settings provided, update recommended config
  if (options.settings) {
    recommendedConfig = { ...recommendedConfig, ...options.settings };
  }

  return {
    plugin: options.plugin,
    currentConfig,
    configSchema,
    recommendedConfig,
    requiredFields,
    optionalFields,
    examples,
  };
}

/**
 * Apply plugin configuration to yama.yaml
 */
export async function applyPluginConfig(
  configPath: string,
  pluginName: string,
  pluginConfig: Record<string, unknown>
): Promise<void> {
  const config = readYamaConfig(configPath) as {
    plugins?: Record<string, Record<string, unknown>> | string[];
  };

  // Ensure plugins object exists
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

  // Update plugin config
  const pluginsObj = config.plugins as Record<string, Record<string, unknown>>;
  pluginsObj[pluginName] = pluginConfig;

  writeYamaConfig(configPath, config);
  success(`Plugin "${pluginName}" configuration updated in yama.yaml`);
}
