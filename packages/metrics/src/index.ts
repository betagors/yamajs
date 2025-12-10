export { default } from "./plugin.js";
export type { MetricsPluginAPI } from "./plugin.js";
export {
  Counter,
  Gauge,
  Histogram,
  MetricRegistry,
  type LabelValues,
} from "./metrics-api.js";
export {
  PrometheusExporter,
  JSONExporter,
  StatsDExporter,
  type MetricsExporter,
} from "./exporters.js";
export {
  autoInstrumentPluginAPI,
  createAutoInstrumenter,
} from "./auto-instrument.js";



















