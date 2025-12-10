import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import { loadPluginFromPackage } from "@betagors/yama-core";

interface PluginSelectionOptions {
  category?: string; // e.g., "database", "email", "storage"
  feature?: string; // e.g., "postgresql", "smtp", "s3"
  config?: string;
}

interface PluginOption {
  name: string;
  category: string;
  description?: string;
  pros: string[];
  cons: string[];
  bestFor: string[];
  configExample?: Record<string, unknown>;
}

/**
 * Get plugin options for a specific category or feature
 */
export async function pluginSelectCommand(
  options: PluginSelectionOptions
): Promise<PluginOption[]> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";
  const configDir = existsSync(configPath) ? getConfigDir(configPath) : process.cwd();

  const optionsList: PluginOption[] = [];

  // Database plugins
  if (!options.category || options.category.toLowerCase() === "database") {
    if (!options.feature || options.feature.toLowerCase().includes("pglite") || options.feature.toLowerCase().includes("lite")) {
      optionsList.push({
        name: "@betagors/yama-pglite",
        category: "database",
        description: "In-memory PostgreSQL database for development and testing",
        pros: [
          "No external database required",
          "Fast setup for development",
          "Perfect for testing",
          "Zero configuration",
        ],
        cons: [
          "Data is lost on restart",
          "Not suitable for production",
          "Limited to single process",
        ],
        bestFor: ["Development", "Testing", "Prototyping", "CI/CD"],
        configExample: {
          url: ":memory:",
        },
      });
    }

    if (!options.feature || options.feature.toLowerCase().includes("postgres") || options.feature.toLowerCase().includes("postgresql")) {
      optionsList.push({
        name: "@betagors/yama-postgres",
        category: "database",
        description: "PostgreSQL database adapter for production use",
        pros: [
          "Production-ready",
          "Full PostgreSQL features",
          "Connection pooling",
          "Migration support",
        ],
        cons: [
          "Requires PostgreSQL server",
          "Needs configuration",
          "External dependency",
        ],
        bestFor: ["Production", "Staging", "Multi-user applications"],
        configExample: {
          url: "${DATABASE_URL}",
        },
      });
    }
  }

  // Email plugins
  if (!options.category || options.category.toLowerCase() === "email") {
    if (!options.feature || options.feature.toLowerCase().includes("smtp")) {
      optionsList.push({
        name: "@betagors/yama-smtp",
        category: "email",
        description: "SMTP email sending plugin",
        pros: [
          "Works with any SMTP server",
          "Supports multiple providers",
          "Simple configuration",
        ],
        cons: [
          "Requires SMTP server",
          "May need authentication setup",
        ],
        bestFor: ["Custom SMTP servers", "SendGrid", "Resend", "Mailpit"],
        configExample: {
          host: "${SMTP_HOST}",
          port: 587,
          secure: true,
          auth: {
            user: "${SMTP_USER}",
            pass: "${SMTP_PASSWORD}",
          },
        },
      });
    }
  }

  // Storage plugins
  if (!options.category || options.category.toLowerCase() === "storage") {
    if (!options.feature || options.feature.toLowerCase().includes("s3")) {
      optionsList.push({
        name: "@betagors/yama-s3",
        category: "storage",
        description: "S3-compatible object storage plugin",
        pros: [
          "S3-compatible (AWS, MinIO, etc.)",
          "Scalable file storage",
          "CDN integration possible",
        ],
        cons: [
          "Requires S3-compatible service",
          "Needs credentials",
          "Costs for storage/bandwidth",
        ],
        bestFor: ["File uploads", "Media storage", "Backups"],
        configExample: {
          endpoint: "${S3_ENDPOINT}",
          region: "${S3_REGION}",
          credentials: {
            accessKeyId: "${S3_ACCESS_KEY}",
            secretAccessKey: "${S3_SECRET_KEY}",
          },
        },
      });
    }
  }

  // Realtime plugins
  if (!options.category || options.category.toLowerCase() === "realtime") {
    if (!options.feature || options.feature.toLowerCase().includes("realtime") || options.feature.toLowerCase().includes("websocket")) {
      optionsList.push({
        name: "@betagors/yama-realtime",
        category: "realtime",
        description: "WebSocket-based realtime communication",
        pros: [
          "Bidirectional communication",
          "Entity change subscriptions",
          "Custom channels support",
        ],
        cons: [
          "Requires WebSocket support",
          "Connection management needed",
        ],
        bestFor: ["Chat applications", "Live updates", "Collaborative features"],
        configExample: {
          enabled: true,
        },
      });
    }
  }

  // Observability plugins
  if (!options.category || options.category.toLowerCase() === "observability") {
    if (!options.feature || options.feature.toLowerCase().includes("logging")) {
      optionsList.push({
        name: "@betagors/yama-logging",
        category: "observability",
        description: "Structured logging plugin",
        pros: [
          "Multiple transports",
          "Structured logs",
          "Log levels",
        ],
        cons: [
          "May need additional storage",
        ],
        bestFor: ["Production logging", "Debugging", "Audit trails"],
        configExample: {
          level: "info",
          transports: ["console", "file"],
        },
      });
    }

    if (!options.feature || options.feature.toLowerCase().includes("metrics")) {
      optionsList.push({
        name: "@betagors/yama-metrics",
        category: "observability",
        description: "Metrics collection and export",
        pros: [
          "Multiple exporters",
          "Auto-instrumentation",
          "Custom metrics",
        ],
        cons: [
          "Requires metrics backend",
        ],
        bestFor: ["Performance monitoring", "Production monitoring"],
        configExample: {
          exporters: ["prometheus"],
        },
      });
    }

    if (!options.feature || options.feature.toLowerCase().includes("health")) {
      optionsList.push({
        name: "@betagors/yama-health",
        category: "observability",
        description: "Health check endpoints",
        pros: [
          "Simple setup",
          "Component health checks",
          "Kubernetes ready",
        ],
        cons: [
          "Basic functionality",
        ],
        bestFor: ["Health monitoring", "Load balancer checks"],
        configExample: {
          enabled: true,
        },
      });
    }
  }

  // Try to fetch additional info from npm for each plugin
  for (const option of optionsList) {
    try {
      const manifest = await loadPluginFromPackage(option.name, configDir);
      if (manifest.category) {
        option.category = manifest.category;
      }
      // Could fetch more info from npm registry here if needed
    } catch {
      // Plugin not installed, that's okay
    }
  }

  return optionsList;
}
