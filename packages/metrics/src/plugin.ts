import type {
  YamaPlugin,
  PluginContext,
  PluginMetrics,
  SummaryStats,
  MonitoringHooks,
  HttpRequest,
  HttpResponse,
  HandlerContext,
  ErrorContext,
} from "@betagors/yama-core";
import {
  pluginMetricsCollector,
  recordPluginAPICall,
  recordPluginError,
} from "@betagors/yama-core";
import {
  Counter,
  Gauge,
  Histogram,
  MetricRegistry,
} from "./metrics-api.js";
import {
  PrometheusExporter,
  JSONExporter,
  StatsDExporter,
  type MetricsExporter,
} from "./exporters.js";
import { createAutoInstrumenter } from "./auto-instrument.js";

/**
 * Metrics plugin API (extends MonitoringHooks)
 */
export interface MetricsPluginAPI extends MonitoringHooks {
  /**
   * Get plugin lifecycle metrics
   */
  getPluginMetrics(pluginName?: string): PluginMetrics | PluginMetrics[];

  /**
   * Get summary statistics
   */
  getSummary(): SummaryStats;

  /**
   * Clear metrics for a plugin or all plugins
   */
  clearMetrics(pluginName?: string): void;

  /**
   * Register a counter metric
   */
  registerCounter(name: string, labels?: string[]): Counter;

  /**
   * Register a gauge metric
   */
  registerGauge(name: string, labels?: string[]): Gauge;

  /**
   * Register a histogram metric
   */
  registerHistogram(name: string, labels?: string[]): Histogram;

  /**
   * Export metrics in specified format
   */
  export(format: "prometheus" | "json" | "statsd"): string;

  /**
   * Add custom exporter
   */
  addExporter(exporter: MetricsExporter): void;

  /**
   * Auto-instrument a plugin API
   */
  autoInstrument(pluginName: string, api: any): any;
}

/**
 * Metrics plugin implementation
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-metrics",
  category: "observability",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(
    opts: Record<string, unknown>,
    context: PluginContext
  ): Promise<MetricsPluginAPI> {
    // Configure collector if options provided
    if (opts.retention || opts.sampling || opts.caching || opts.batching) {
      pluginMetricsCollector.configure({
        retention: opts.retention as any,
        sampling: opts.sampling as any,
        caching: opts.caching as any,
        batching: opts.batching as any,
      });
    }

    // Create metric registry
    const registry = new MetricRegistry();

    // Register default HTTP metrics (store references for use in MonitoringHooks)
    const httpRequestsCounter = registry.registerCounter("http_requests", ["method", "path", "status"]);
    const httpRequestDurationHistogram = registry.registerHistogram("http_request_duration_ms", ["method", "path"]);
    const httpErrorsCounter = registry.registerCounter("http_errors", ["method", "path", "error_type"]);

    // Create exporters
    const exporters = new Map<string, MetricsExporter>([
      ["prometheus", new PrometheusExporter()],
      ["json", new JSONExporter()],
      ["statsd", new StatsDExporter()],
    ]);

    // Create auto-instrumenter
    const autoInstrument = createAutoInstrumenter(
      (pluginName) => {
        recordPluginAPICall(pluginName);
      },
      (pluginName, error) => {
        recordPluginError(pluginName, error);
      }
    );

    // Listen to plugin lifecycle events
    context.on("plugin:loaded", ({ name }: { name: string }) => {
      // Metrics are already tracked by registry, but we can add custom tracking here
      context.logger.debug(`Plugin loaded: ${name}`);
    });

    context.on("plugin:error", ({ name, error }: { name: string; error: Error }) => {
      // Errors are already tracked, but we can add custom tracking here
      context.logger.debug(`Plugin error: ${name}`, error);
    });

    // Create and return API
    const api: MetricsPluginAPI = {
      getPluginMetrics(pluginName?: string): PluginMetrics | PluginMetrics[] {
        if (pluginName) {
          const metrics = pluginMetricsCollector.getMetrics(pluginName);
          if (!metrics) {
            // Return empty metrics if not found
            return {
              pluginName,
              loadTime: 0,
              initTime: 0,
              apiCalls: 0,
              errors: 0,
            };
          }
          return metrics;
        }
        return pluginMetricsCollector.getAllMetrics();
      },

      getSummary(): SummaryStats {
        return pluginMetricsCollector.getSummary();
      },

      clearMetrics(pluginName?: string): void {
        if (pluginName) {
          pluginMetricsCollector.clearMetrics(pluginName);
        } else {
          pluginMetricsCollector.clearAllMetrics();
        }
        registry.clear();
      },

      registerCounter(name: string, labels: string[] = []): Counter {
        return registry.registerCounter(name, labels);
      },

      registerGauge(name: string, labels: string[] = []): Gauge {
        return registry.registerGauge(name, labels);
      },

      registerHistogram(name: string, labels: string[] = []): Histogram {
        return registry.registerHistogram(name, labels);
      },

      export(format: "prometheus" | "json" | "statsd"): string {
        const exporter = exporters.get(format);
        if (!exporter) {
          throw new Error(`Unknown export format: ${format}`);
        }
        return exporter.export(registry);
      },

      addExporter(exporter: MetricsExporter): void {
        // Allow custom exporters to be added
        // For now, we'll just store them (can be enhanced later)
        context.logger.debug("Custom exporter added");
      },

      autoInstrument(pluginName: string, api: any): any {
        return autoInstrument(pluginName, api);
      },

      // MonitoringHooks implementation
      onRequestStart(req: HttpRequest, context: HandlerContext): void {
        // Request start tracking can be added here if needed
        // For now, we rely on onRequestEnd for metrics
      },

      onRequestEnd(
        req: HttpRequest,
        res: HttpResponse,
        duration: number,
        context: HandlerContext
      ): void {
        // Get status code from response (may need to be extracted from reply object)
        const statusCode = (res as any).statusCode || (context._statusCode || 200);
        
        // Record HTTP request metrics
        httpRequestsCounter.inc({
          method: req.method,
          path: req.path,
          status: statusCode.toString(),
        });
        
        // Record request duration in milliseconds
        httpRequestDurationHistogram.observe(duration, {
          method: req.method,
          path: req.path,
        });
      },

      onError(error: Error, errorContext: ErrorContext): void {
        const method = errorContext.request?.method || "UNKNOWN";
        const path = errorContext.request?.path || "UNKNOWN";
        const errorType = error.constructor.name || "Error";
        
        // Record error metric
        httpErrorsCounter.inc({
          method,
          path,
          error_type: errorType,
        });
      },
    };

    // Register as metrics service
    context.registerService("metrics", api);
    // Also register as monitoring service to receive hooks
    context.registerService("monitoring", api);
    context.logger.info("Metrics service registered (also available as monitoring service)");

    return api;
  },

  async onHealthCheck() {
    const summary = pluginMetricsCollector.getSummary();
    return {
      healthy: true,
      details: {
        totalPlugins: summary.totalPlugins,
        totalErrors: summary.totalErrors,
      },
    };
  },
};

export default plugin;

