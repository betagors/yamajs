import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { readYamaConfig } from "../utils/file-utils.ts";

interface PluginRecommendationOptions {
  config?: string;
  feature?: string; // Optional: specific feature to check for
}

interface PluginRecommendation {
  plugin: string;
  reason: string;
  priority: "high" | "medium" | "low";
  category: string;
  description?: string;
}

/**
 * Analyze project and recommend plugins based on configuration and entities
 */
export async function pluginRecommendCommand(
  options: PluginRecommendationOptions
): Promise<PluginRecommendation[]> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    return [];
  }

  const config = readYamaConfig(configPath) as {
    plugins?: Record<string, Record<string, unknown>> | string[];
    entities?: Record<string, any>;
    endpoints?: Array<{ path: string; method: string; handler?: string }>;
    auth?: any;
    database?: any;
  };

  const recommendations: PluginRecommendation[] = [];
  const existingPlugins = new Set<string>();

  // Get existing plugins
  if (config.plugins) {
    if (Array.isArray(config.plugins)) {
      config.plugins.forEach((p) => existingPlugins.add(p));
    } else {
      Object.keys(config.plugins).forEach((p) => existingPlugins.add(p));
    }
  }

  // Check for database plugin
  const hasDatabasePlugin = Array.from(existingPlugins).some(
    (p) => p.includes("postgres") || p.includes("pglite") || p.includes("database")
  );
  if (!hasDatabasePlugin && config.entities) {
    recommendations.push({
      plugin: "@betagors/yama-pglite",
      reason: "Project has entities but no database plugin configured",
      priority: "high",
      category: "database",
      description: "Required for entity persistence and migrations",
    });
  }

  // Check for authentication needs
  if (config.auth && !existingPlugins.has("@betagors/yama-auth")) {
    recommendations.push({
      plugin: "@betagors/yama-auth",
      reason: "Authentication is configured but auth plugin is not installed",
      priority: "high",
      category: "authentication",
      description: "Provides authentication and authorization features",
    });
  }

  // Check for file uploads (entities with file/image fields)
  if (config.entities) {
    const hasFileFields = Object.values(config.entities).some((entity: any) => {
      const fields = entity.fields || {};
      return Object.keys(fields).some(
        (field) =>
          fields[field]?.includes("file") ||
          fields[field]?.includes("image") ||
          field.toLowerCase().includes("image") ||
          field.toLowerCase().includes("file") ||
          field.toLowerCase().includes("upload")
      );
    });

    if (hasFileFields && !existingPlugins.has("@betagors/yama-s3")) {
      recommendations.push({
        plugin: "@betagors/yama-s3",
        reason: "Entities contain file/image fields but no storage plugin configured",
        priority: "medium",
        category: "storage",
        description: "Provides S3-compatible storage for file uploads",
      });
    }
  }

  // Check for email functionality
  const hasEmailEndpoints = config.endpoints?.some(
    (ep) =>
      ep.handler?.includes("email") ||
      ep.path?.includes("email") ||
      ep.path?.includes("send")
  );
  if (hasEmailEndpoints && !existingPlugins.has("@betagors/yama-smtp")) {
    recommendations.push({
      plugin: "@betagors/yama-smtp",
      reason: "Endpoints suggest email functionality but no email plugin configured",
      priority: "medium",
      category: "email",
      description: "Provides SMTP email sending capabilities",
    });
  }

  // Check for realtime features
  if (config.endpoints?.some((ep) => ep.path?.includes("realtime") || ep.path?.includes("ws"))) {
    if (!existingPlugins.has("@betagors/yama-realtime")) {
      recommendations.push({
        plugin: "@betagors/yama-realtime",
        reason: "Realtime endpoints detected but realtime plugin is not configured",
        priority: "medium",
        category: "realtime",
        description: "Provides WebSocket-based realtime features",
      });
    }
  }

  // Check for logging needs (production readiness)
  if (!existingPlugins.has("@betagors/yama-logging")) {
    recommendations.push({
      plugin: "@betagors/yama-logging",
      reason: "Structured logging is recommended for production applications",
      priority: "low",
      category: "observability",
      description: "Provides structured logging with multiple transports",
    });
  }

  // Check for metrics needs
  if (!existingPlugins.has("@betagors/yama-metrics")) {
    recommendations.push({
      plugin: "@betagors/yama-metrics",
      reason: "Metrics collection is recommended for monitoring production applications",
      priority: "low",
      category: "observability",
      description: "Provides metrics collection and export capabilities",
    });
  }

  // Check for health checks
  if (!existingPlugins.has("@betagors/yama-health")) {
    recommendations.push({
      plugin: "@betagors/yama-health",
      reason: "Health checks are recommended for production deployments",
      priority: "low",
      category: "observability",
      description: "Provides health check endpoints for monitoring",
    });
  }

  // Filter by feature if specified
  if (options.feature) {
    return recommendations.filter(
      (r) =>
        r.category.toLowerCase().includes(options.feature!.toLowerCase()) ||
        r.plugin.toLowerCase().includes(options.feature!.toLowerCase()) ||
        r.reason.toLowerCase().includes(options.feature!.toLowerCase())
    );
  }

  return recommendations;
}
