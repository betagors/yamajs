import { describe, it, expect, beforeEach } from "vitest";
import { Counter, Gauge, Histogram, MetricRegistry } from "./metrics-api.js";

describe("Counter", () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter("test_counter");
  });

  it("should initialize with zero value", () => {
    expect(counter.get()).toBe(0);
  });

  it("should increment by 1", () => {
    counter.inc();
    expect(counter.get()).toBe(1);

    counter.inc();
    expect(counter.get()).toBe(2);
  });

  it("should add specific value", () => {
    counter.add(5);
    expect(counter.get()).toBe(5);

    counter.add(3);
    expect(counter.get()).toBe(8);
  });

  it("should throw error when trying to decrement", () => {
    expect(() => counter.add(-1)).toThrow("Counter cannot be decremented");
  });

  it("should reset to zero", () => {
    counter.add(10);
    expect(counter.get()).toBe(10);

    counter.reset();
    expect(counter.get()).toBe(0);
  });

  it("should work with labels", () => {
    const labeledCounter = new Counter("labeled_counter", ["status", "method"]);

    labeledCounter.inc({ status: "200", method: "GET" });
    labeledCounter.inc({ status: "200", method: "GET" });
    labeledCounter.inc({ status: "404", method: "GET" });

    expect(labeledCounter.get({ status: "200", method: "GET" })).toBe(2);
    expect(labeledCounter.get({ status: "404", method: "GET" })).toBe(1);
  });

  it("should get all labeled values", () => {
    const labeledCounter = new Counter("labeled_counter", ["status"]);

    labeledCounter.inc({ status: "200" });
    labeledCounter.inc({ status: "200" });
    labeledCounter.inc({ status: "404" });

    const all = labeledCounter.getAll();
    expect(all.size).toBe(2);
    expect(all.get("status=200")).toBe(2);
    expect(all.get("status=404")).toBe(1);
  });
});

describe("Gauge", () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge("test_gauge");
  });

  it("should initialize with zero value", () => {
    expect(gauge.get()).toBe(0);
  });

  it("should set value", () => {
    gauge.set(42);
    expect(gauge.get()).toBe(42);

    gauge.set(100);
    expect(gauge.get()).toBe(100);
  });

  it("should increment by 1", () => {
    gauge.inc();
    expect(gauge.get()).toBe(1);

    gauge.inc();
    expect(gauge.get()).toBe(2);
  });

  it("should decrement by 1", () => {
    gauge.set(10);
    gauge.dec();
    expect(gauge.get()).toBe(9);

    gauge.dec();
    expect(gauge.get()).toBe(8);
  });

  it("should add value (can be negative)", () => {
    gauge.set(10);
    gauge.add(5);
    expect(gauge.get()).toBe(15);

    gauge.add(-3);
    expect(gauge.get()).toBe(12);
  });

  it("should reset to zero", () => {
    gauge.set(50);
    expect(gauge.get()).toBe(50);

    gauge.reset();
    expect(gauge.get()).toBe(0);
  });

  it("should work with labels", () => {
    const labeledGauge = new Gauge("labeled_gauge", ["instance"]);

    labeledGauge.set(10, { instance: "server1" });
    labeledGauge.set(20, { instance: "server2" });

    expect(labeledGauge.get({ instance: "server1" })).toBe(10);
    expect(labeledGauge.get({ instance: "server2" })).toBe(20);
  });
});

describe("Histogram", () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram("test_histogram");
  });

  it("should initialize with empty buckets", () => {
    expect(histogram.get()).toEqual([]);
  });

  it("should observe values", () => {
    histogram.observe(0.1);
    histogram.observe(0.5);
    histogram.observe(1.0);

    const values = histogram.get();
    expect(values).toContain(0.1);
    expect(values).toContain(0.5);
    expect(values).toContain(1.0);
    expect(values.length).toBe(3);
  });

  it("should calculate percentile", () => {
    histogram.observe(10);
    histogram.observe(20);
    histogram.observe(30);
    histogram.observe(40);
    histogram.observe(50);

    expect(histogram.percentile(50)).toBeGreaterThanOrEqual(20);
    expect(histogram.percentile(50)).toBeLessThanOrEqual(30);
    expect(histogram.percentile(100)).toBeGreaterThanOrEqual(50);
  });

  it("should return 0 for percentile of empty histogram", () => {
    expect(histogram.percentile(50)).toBe(0);
  });

  it("should reset histogram", () => {
    histogram.observe(1);
    histogram.observe(2);
    expect(histogram.get().length).toBe(2);

    histogram.reset();
    expect(histogram.get().length).toBe(0);
  });

  it("should work with labels", () => {
    const labeledHistogram = new Histogram("labeled_histogram", ["endpoint"]);

    labeledHistogram.observe(0.1, { endpoint: "/api/users" });
    labeledHistogram.observe(0.2, { endpoint: "/api/users" });
    labeledHistogram.observe(0.5, { endpoint: "/api/posts" });

    const usersValues = labeledHistogram.get({ endpoint: "/api/users" });
    expect(usersValues).toContain(0.1);
    expect(usersValues).toContain(0.2);
    expect(usersValues.length).toBe(2);

    const postsValues = labeledHistogram.get({ endpoint: "/api/posts" });
    expect(postsValues).toContain(0.5);
    expect(postsValues.length).toBe(1);
  });
});

describe("MetricRegistry", () => {
  let registry: MetricRegistry;

  beforeEach(() => {
    registry = new MetricRegistry();
  });

  describe("registerCounter", () => {
    it("should register a counter", () => {
      const counter = registry.registerCounter("test_counter");

      expect(counter).toBeInstanceOf(Counter);
      expect(counter.name).toBe("test_counter");
    });

    it("should return existing counter if already registered", () => {
      const counter1 = registry.registerCounter("test_counter");
      const counter2 = registry.registerCounter("test_counter");

      expect(counter1).toBe(counter2);
    });

    it("should register counter with labels", () => {
      const counter = registry.registerCounter("labeled_counter", ["status"]);

      expect(counter).toBeInstanceOf(Counter);
      counter.inc({ status: "200" });
      expect(counter.get({ status: "200" })).toBe(1);
    });
  });

  describe("registerGauge", () => {
    it("should register a gauge", () => {
      const gauge = registry.registerGauge("test_gauge");

      expect(gauge).toBeInstanceOf(Gauge);
      expect(gauge.name).toBe("test_gauge");
    });

    it("should return existing gauge if already registered", () => {
      const gauge1 = registry.registerGauge("test_gauge");
      const gauge2 = registry.registerGauge("test_gauge");

      expect(gauge1).toBe(gauge2);
    });
  });

  describe("registerHistogram", () => {
    it("should register a histogram", () => {
      const histogram = registry.registerHistogram("test_histogram");

      expect(histogram).toBeInstanceOf(Histogram);
      expect(histogram.name).toBe("test_histogram");
    });

    it("should return existing histogram if already registered", () => {
      const histogram1 = registry.registerHistogram("test_histogram");
      const histogram2 = registry.registerHistogram("test_histogram");

      expect(histogram1).toBe(histogram2);
    });
  });

  describe("getCounters", () => {
    it("should return all registered counters", () => {
      registry.registerCounter("counter1");
      registry.registerCounter("counter2");

      const counters = registry.getCounters();
      expect(counters.length).toBe(2);
      expect(counters.map((c) => c.name)).toContain("counter1");
      expect(counters.map((c) => c.name)).toContain("counter2");
    });

    it("should return empty array when no counters registered", () => {
      expect(registry.getCounters()).toEqual([]);
    });
  });

  describe("getGauges", () => {
    it("should return all registered gauges", () => {
      registry.registerGauge("gauge1");
      registry.registerGauge("gauge2");

      const gauges = registry.getGauges();
      expect(gauges.length).toBe(2);
      expect(gauges.map((g) => g.name)).toContain("gauge1");
      expect(gauges.map((g) => g.name)).toContain("gauge2");
    });
  });

  describe("getHistograms", () => {
    it("should return all registered histograms", () => {
      registry.registerHistogram("histogram1");
      registry.registerHistogram("histogram2");

      const histograms = registry.getHistograms();
      expect(histograms.length).toBe(2);
      expect(histograms.map((h) => h.name)).toContain("histogram1");
      expect(histograms.map((h) => h.name)).toContain("histogram2");
    });
  });

  describe("clear", () => {
    it("should clear all metrics", () => {
      registry.registerCounter("counter1");
      registry.registerGauge("gauge1");
      registry.registerHistogram("histogram1");

      expect(registry.getCounters().length).toBe(1);
      expect(registry.getGauges().length).toBe(1);
      expect(registry.getHistograms().length).toBe(1);

      registry.clear();

      expect(registry.getCounters().length).toBe(0);
      expect(registry.getGauges().length).toBe(0);
      expect(registry.getHistograms().length).toBe(0);
    });
  });
});

