import type { Counter, Gauge, Histogram, LabelValues } from "./metrics-api.js";
import type { MetricRegistry } from "./metrics-api.js";

/**
 * Base exporter interface
 */
export interface MetricsExporter {
  export(registry: MetricRegistry): string;
}

/**
 * Prometheus text format exporter
 */
export class PrometheusExporter implements MetricsExporter {
  export(registry: MetricRegistry): string {
    const lines: string[] = [];

    // Export counters
    for (const counter of registry.getCounters()) {
      const value = counter.get();
      lines.push(`# TYPE ${counter.name} counter`);
      lines.push(`${counter.name} ${value}`);

      // Export labeled counters
      for (const [key, value] of counter.getAll()) {
        const labels = this.parseLabelKey(key);
        const labelStr = this.formatLabels(labels);
        lines.push(`${counter.name}{${labelStr}} ${value}`);
      }
    }

    // Export gauges
    for (const gauge of registry.getGauges()) {
      const value = gauge.get();
      lines.push(`# TYPE ${gauge.name} gauge`);
      lines.push(`${gauge.name} ${value}`);

      // Export labeled gauges
      for (const [key, value] of gauge.getAll()) {
        const labels = this.parseLabelKey(key);
        const labelStr = this.formatLabels(labels);
        lines.push(`${gauge.name}{${labelStr}} ${value}`);
      }
    }

    // Export histograms
    for (const histogram of registry.getHistograms()) {
      lines.push(`# TYPE ${histogram.name} histogram`);
      const values = histogram.get();
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const count = values.length;
        lines.push(`${histogram.name}_sum ${sum}`);
        lines.push(`${histogram.name}_count ${count}`);

        // Export percentiles
        const p50 = histogram.percentile(50);
        const p95 = histogram.percentile(95);
        const p99 = histogram.percentile(99);
        lines.push(`${histogram.name}_p50 ${p50}`);
        lines.push(`${histogram.name}_p95 ${p95}`);
        lines.push(`${histogram.name}_p99 ${p99}`);
      }

      // Export labeled histograms
      for (const [key, values] of histogram.getAll()) {
        const labels = this.parseLabelKey(key);
        const labelStr = this.formatLabels(labels);
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const count = values.length;
          lines.push(`${histogram.name}_sum{${labelStr}} ${sum}`);
          lines.push(`${histogram.name}_count{${labelStr}} ${count}`);
        }
      }
    }

    return lines.join("\n") + "\n";
  }

  private parseLabelKey(key: string): LabelValues {
    const labels: LabelValues = {};
    const pairs = key.split(",");
    for (const pair of pairs) {
      const [name, value] = pair.split("=");
      if (name && value) {
        const numValue = Number(value);
        labels[name] = isNaN(numValue) ? value : numValue;
      }
    }
    return labels;
  }

  private formatLabels(labels: LabelValues): string {
    return Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(",");
  }
}

/**
 * JSON format exporter
 */
export class JSONExporter implements MetricsExporter {
  export(registry: MetricRegistry): string {
    const data = {
      counters: registry.getCounters().map((c) => ({
        name: c.name,
        value: c.get(),
        labeled: Object.fromEntries(c.getAll()),
      })),
      gauges: registry.getGauges().map((g) => ({
        name: g.name,
        value: g.get(),
        labeled: Object.fromEntries(g.getAll()),
      })),
      histograms: registry.getHistograms().map((h) => {
        const values = h.get();
        return {
          name: h.name,
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          min: values.length > 0 ? Math.min(...values) : 0,
          max: values.length > 0 ? Math.max(...values) : 0,
          p50: h.percentile(50),
          p95: h.percentile(95),
          p99: h.percentile(99),
          labeled: Object.fromEntries(
            Array.from(h.getAll()).map(([key, values]) => [
              key,
              {
                count: values.length,
                sum: values.reduce((a, b) => a + b, 0),
                min: values.length > 0 ? Math.min(...values) : 0,
                max: values.length > 0 ? Math.max(...values) : 0,
              },
            ])
          ),
        };
      }),
    };

    return JSON.stringify(data, null, 2);
  }
}

/**
 * StatsD exporter (stub implementation)
 */
export class StatsDExporter implements MetricsExporter {
  export(registry: MetricRegistry): string {
    // Stub implementation - can be enhanced later with actual StatsD protocol
    const lines: string[] = [];

    for (const counter of registry.getCounters()) {
      lines.push(`${counter.name}:${counter.get()}|c`);
    }

    for (const gauge of registry.getGauges()) {
      lines.push(`${gauge.name}:${gauge.get()}|g`);
    }

    for (const histogram of registry.getHistograms()) {
      const values = histogram.get();
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        lines.push(`${histogram.name}:${sum}|h`);
      }
    }

    return lines.join("\n");
  }
}













