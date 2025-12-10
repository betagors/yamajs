/**
 * Label values for metrics
 */
export type LabelValues = Record<string, string | number>;

/**
 * Counter metric - increments only
 */
export class Counter {
  private value = 0;
  private valuesByLabels = new Map<string, number>();
  private labels: string[];

  constructor(
    public readonly name: string,
    labels: string[] = [],
    private onUpdate?: (counter: Counter) => void
  ) {
    this.labels = [...labels];
  }

  /**
   * Increment counter by 1
   */
  inc(labels?: LabelValues): void {
    this.add(1, labels);
  }

  /**
   * Add value to counter
   */
  add(value: number, labels?: LabelValues): void {
    if (value < 0) {
      throw new Error("Counter cannot be decremented");
    }

    if (labels && this.labels.length > 0) {
      const key = this.getLabelKey(labels);
      const current = this.valuesByLabels.get(key) || 0;
      this.valuesByLabels.set(key, current + value);
    } else {
      this.value += value;
    }

    this.onUpdate?.(this);
  }

  /**
   * Get counter value
   */
  get(labels?: LabelValues): number {
    if (labels && this.labels.length > 0) {
      const key = this.getLabelKey(labels);
      return this.valuesByLabels.get(key) || 0;
    }
    return this.value;
  }

  /**
   * Get all values by labels
   */
  getAll(): Map<string, number> {
    return new Map(this.valuesByLabels);
  }

  /**
   * Reset counter
   */
  reset(): void {
    this.value = 0;
    this.valuesByLabels.clear();
  }

  private getLabelKey(labels: LabelValues): string {
    return this.labels
      .map((label) => `${label}=${labels[label]}`)
      .join(",");
  }
}

/**
 * Gauge metric - can increase or decrease
 */
export class Gauge {
  private value = 0;
  private valuesByLabels = new Map<string, number>();
  private labels: string[];

  constructor(
    public readonly name: string,
    labels: string[] = [],
    private onUpdate?: (gauge: Gauge) => void
  ) {
    this.labels = [...labels];
  }

  /**
   * Set gauge value
   */
  set(value: number, labels?: LabelValues): void {
    if (labels && this.labels.length > 0) {
      const key = this.getLabelKey(labels);
      this.valuesByLabels.set(key, value);
    } else {
      this.value = value;
    }

    this.onUpdate?.(this);
  }

  /**
   * Increment gauge by 1
   */
  inc(labels?: LabelValues): void {
    this.add(1, labels);
  }

  /**
   * Decrement gauge by 1
   */
  dec(labels?: LabelValues): void {
    this.add(-1, labels);
  }

  /**
   * Add value to gauge
   */
  add(value: number, labels?: LabelValues): void {
    if (labels && this.labels.length > 0) {
      const key = this.getLabelKey(labels);
      const current = this.valuesByLabels.get(key) || 0;
      this.valuesByLabels.set(key, current + value);
    } else {
      this.value += value;
    }

    this.onUpdate?.(this);
  }

  /**
   * Get gauge value
   */
  get(labels?: LabelValues): number {
    if (labels && this.labels.length > 0) {
      const key = this.getLabelKey(labels);
      return this.valuesByLabels.get(key) || 0;
    }
    return this.value;
  }

  /**
   * Get all values by labels
   */
  getAll(): Map<string, number> {
    return new Map(this.valuesByLabels);
  }

  /**
   * Reset gauge
   */
  reset(): void {
    this.value = 0;
    this.valuesByLabels.clear();
  }

  private getLabelKey(labels: LabelValues): string {
    return this.labels
      .map((label) => `${label}=${labels[label]}`)
      .join(",");
  }
}

/**
 * Histogram metric - tracks value distributions
 */
export class Histogram {
  private buckets: number[] = [];
  private valuesByLabels = new Map<string, number[]>();
  private labels: string[];

  constructor(
    public readonly name: string,
    labels: string[] = [],
    private onUpdate?: (histogram: Histogram) => void
  ) {
    this.labels = [...labels];
    // Default buckets: 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
    this.buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  /**
   * Observe a value
   */
  observe(value: number, labels?: LabelValues): void {
    if (labels && this.labels.length > 0) {
      const key = this.getLabelKey(labels);
      const values = this.valuesByLabels.get(key) || [];
      values.push(value);
      this.valuesByLabels.set(key, values);
    } else {
      this.buckets.push(value);
    }

    this.onUpdate?.(this);
  }

  /**
   * Get values for labels
   */
  get(labels?: LabelValues): number[] {
    if (labels && this.labels.length > 0) {
      const key = this.getLabelKey(labels);
      return this.valuesByLabels.get(key) || [];
    }
    return [...this.buckets];
  }

  /**
   * Calculate percentile
   */
  percentile(p: number, labels?: LabelValues): number {
    const values = this.get(labels).sort((a, b) => a - b);
    if (values.length === 0) return 0;

    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)] || 0;
  }

  /**
   * Get all values by labels
   */
  getAll(): Map<string, number[]> {
    return new Map(this.valuesByLabels);
  }

  /**
   * Reset histogram
   */
  reset(): void {
    this.buckets = [];
    this.valuesByLabels.clear();
  }

  private getLabelKey(labels: LabelValues): string {
    return this.labels
      .map((label) => `${label}=${labels[label]}`)
      .join(",");
  }
}

/**
 * Metric registry
 */
export class MetricRegistry {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();

  /**
   * Register a counter
   */
  registerCounter(
    name: string,
    labels: string[] = []
  ): Counter {
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }

    const counter = new Counter(name, labels);
    this.counters.set(name, counter);
    return counter;
  }

  /**
   * Register a gauge
   */
  registerGauge(name: string, labels: string[] = []): Gauge {
    if (this.gauges.has(name)) {
      return this.gauges.get(name)!;
    }

    const gauge = new Gauge(name, labels);
    this.gauges.set(name, gauge);
    return gauge;
  }

  /**
   * Register a histogram
   */
  registerHistogram(name: string, labels: string[] = []): Histogram {
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }

    const histogram = new Histogram(name, labels);
    this.histograms.set(name, histogram);
    return histogram;
  }

  /**
   * Get all counters
   */
  getCounters(): Counter[] {
    return Array.from(this.counters.values());
  }

  /**
   * Get all gauges
   */
  getGauges(): Gauge[] {
    return Array.from(this.gauges.values());
  }

  /**
   * Get all histograms
   */
  getHistograms(): Histogram[] {
    return Array.from(this.histograms.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}



















