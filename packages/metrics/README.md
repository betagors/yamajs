# @betagors/yama-metrics

Yama metrics and telemetry plugin for collecting and exporting plugin metrics.

## Features

- Automatic plugin lifecycle metrics tracking
- Custom metrics support (counters, gauges, histograms)
- Prometheus and JSON export formats
- Auto-instrumentation of plugin APIs
- Configurable retention and sampling
- Event-driven metrics collection

## Installation

```bash
npm install @betagors/yama-metrics
```

## Configuration

```yaml
plugins:
  "@betagors/yama-metrics":
    enabled: true
    retention:
      enabled: true
      maxAge: 3600000  # 1 hour
    sampling:
      enabled: false
      sampleRate: 1.0
```

## Usage

### Accessing Metrics Service

```typescript
// In your plugin
async init(opts, context) {
  const metrics = context.getService("metrics");
  
  if (metrics) {
    // Register custom metrics
    const counter = metrics.registerCounter("my_metric_total", ["label1"]);
    counter.inc({ label1: "value1" });
  }
  
  return { /* plugin API */ };
}
```

### Exporting Metrics

```typescript
const metrics = context.getService("metrics");

// Prometheus format
const prometheus = metrics.export("prometheus");

// JSON format
const json = metrics.export("json");
```

## API

- `getPluginMetrics(pluginName?)` - Get plugin lifecycle metrics
- `getSummary()` - Get summary statistics
- `registerCounter(name, labels?)` - Register a counter metric
- `registerGauge(name, labels?)` - Register a gauge metric
- `registerHistogram(name, labels?)` - Register a histogram metric
- `export(format)` - Export metrics in specified format
- `autoInstrument(pluginName, api)` - Auto-instrument a plugin API



















