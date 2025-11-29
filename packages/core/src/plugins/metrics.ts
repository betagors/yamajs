import type { YamaPlugin } from "./base.js";

/**
 * Plugin metrics
 */
export interface PluginMetrics {
  pluginName: string;
  loadTime: number; // milliseconds
  initTime: number; // milliseconds
  apiCalls: number;
  errors: number;
  lastError?: {
    message: string;
    timestamp: Date;
  };
  lastLoadTime?: Date;
  memoryUsage?: number; // bytes (if available)
}

/**
 * Summary statistics
 */
export interface SummaryStats {
  totalPlugins: number;
  totalLoadTime: number;
  totalInitTime: number;
  totalAPICalls: number;
  totalErrors: number;
  averageLoadTime: number;
  averageInitTime: number;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  retention?: {
    enabled: boolean;
    maxAge?: number; // milliseconds
    maxMetrics?: number; // per plugin
  };
  sampling?: {
    enabled: boolean;
    sampleRate?: number; // 0.0 to 1.0
  };
  caching?: {
    enabled: boolean;
    summaryCacheTTL?: number; // milliseconds
  };
  batching?: {
    enabled: boolean;
    batchWindow?: number; // milliseconds
  };
}

/**
 * Generic circular buffer implementation
 */
class CircularBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;
  private index = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(item);
    } else {
      this.buffer[this.index] = item;
      this.index = (this.index + 1) % this.maxSize;
    }
  }

  getValues(): T[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
    this.index = 0;
  }

  get length(): number {
    return this.buffer.length;
  }
}

/**
 * Metrics collector for plugins
 */
class PluginMetricsCollector {
  private metrics = new Map<string, PluginMetrics>();
  private loadStartTimes = new Map<string, number>();
  private initStartTimes = new Map<string, number>();
  private config: MetricsConfig = {
    retention: { enabled: false },
    sampling: { enabled: false, sampleRate: 1.0 },
    caching: { enabled: true, summaryCacheTTL: 1000 },
    batching: { enabled: false, batchWindow: 100 },
  };
  private summaryCache: SummaryStats | null = null;
  private summaryCacheTime: number = 0;
  private updateQueue: Array<() => void> = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private apiCallTimestamps = new Map<string, CircularBuffer<number>>();
  private eventListeners = new Map<string, Set<Function>>();

  /**
   * Configure the metrics collector
   */
  configure(config: Partial<MetricsConfig>): void {
    this.config = {
      retention: { 
        enabled: config.retention?.enabled ?? this.config.retention?.enabled ?? false,
        ...this.config.retention,
        ...config.retention,
      },
      sampling: { 
        enabled: config.sampling?.enabled ?? this.config.sampling?.enabled ?? false,
        ...this.config.sampling,
        ...config.sampling,
      },
      caching: { 
        enabled: config.caching?.enabled ?? this.config.caching?.enabled ?? true,
        ...this.config.caching,
        ...config.caching,
      },
      batching: { 
        enabled: config.batching?.enabled ?? this.config.batching?.enabled ?? false,
        ...this.config.batching,
        ...config.batching,
      },
    };
    this.invalidateCache();
  }

  /**
   * Register event listener for plugin events
   */
  onPluginEvent(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  offPluginEvent(event: string, handler: Function): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to registered listeners
   */
  private emitEvent(event: string, data?: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in metrics event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Invalidate summary cache
   */
  private invalidateCache(): void {
    this.summaryCache = null;
  }

  /**
   * Create default metrics for a plugin
   */
  private createDefaultMetrics(pluginName: string): PluginMetrics {
    return {
      pluginName,
      loadTime: 0,
      initTime: 0,
      apiCalls: 0,
      errors: 0,
    };
  }

  /**
   * Get or create metrics for a plugin (single lookup pattern)
   */
  private getOrCreateMetrics(pluginName: string): PluginMetrics {
    let metrics = this.metrics.get(pluginName);
    if (!metrics) {
      metrics = this.createDefaultMetrics(pluginName);
      this.metrics.set(pluginName, metrics);
    }
    return metrics;
  }

  /**
   * Apply retention policy
   */
  private applyRetention(pluginName: string): void {
    if (!this.config.retention?.enabled) return;

    const metrics = this.metrics.get(pluginName);
    if (!metrics) return;

    const maxAge = this.config.retention.maxAge || 3600000; // 1 hour default
    const cutoff = Date.now() - maxAge;

    if (metrics.lastLoadTime && metrics.lastLoadTime.getTime() < cutoff) {
      this.metrics.delete(pluginName);
      return;
    }

    // Check max count for API call timestamps
    const maxCount = this.config.retention.maxMetrics || 1000;
    const timestamps = this.apiCallTimestamps.get(pluginName);
    if (timestamps && timestamps.length > maxCount) {
      // Keep only recent timestamps
      const recent = timestamps.getValues().slice(-maxCount);
      const newBuffer = new CircularBuffer<number>(maxCount);
      recent.forEach((ts) => newBuffer.push(ts));
      this.apiCallTimestamps.set(pluginName, newBuffer);
    }
  }

  /**
   * Schedule batch update
   */
  private scheduleBatch(): void {
    if (!this.config.batching?.enabled || this.batchTimeout) return;

    const batchWindow = this.config.batching.batchWindow || 100;
    this.batchTimeout = setTimeout(() => {
      const updates = this.updateQueue.splice(0);
      updates.forEach((update) => update());
      this.batchTimeout = null;
      if (this.updateQueue.length > 0) {
        this.scheduleBatch();
      }
    }, batchWindow);
  }

  /**
   * Check if metric should be sampled
   */
  private shouldSample(): boolean {
    if (!this.config.sampling?.enabled) return true;
    const sampleRate = this.config.sampling.sampleRate || 1.0;
    return Math.random() <= sampleRate;
  }

  /**
   * Get sample scale factor
   */
  private getSampleScale(): number {
    if (!this.config.sampling?.enabled) return 1.0;
    const sampleRate = this.config.sampling.sampleRate || 1.0;
    return sampleRate > 0 ? 1.0 / sampleRate : 1.0;
  }

  /**
   * Start tracking plugin load
   */
  startLoad(pluginName: string): void {
    this.loadStartTimes.set(pluginName, Date.now());
  }

  /**
   * Start tracking plugin init
   */
  startInit(pluginName: string): void {
    this.initStartTimes.set(pluginName, Date.now());
  }

  /**
   * Record plugin loaded
   */
  recordLoaded(pluginName: string, trackMemory = false): void {
    const loadStart = this.loadStartTimes.get(pluginName);
    const loadTime = loadStart ? Date.now() - loadStart : 0;

    const metrics: PluginMetrics = {
      pluginName,
      loadTime,
      initTime: 0,
      apiCalls: 0,
      errors: 0,
      lastLoadTime: new Date(),
    };

    if (trackMemory && typeof process !== "undefined" && process.memoryUsage) {
      metrics.memoryUsage = process.memoryUsage().heapUsed;
    }

    this.metrics.set(pluginName, metrics);
    this.loadStartTimes.delete(pluginName);
    this.invalidateCache();
    this.emitEvent("plugin:loaded", { pluginName, metrics });
  }

  /**
   * Record plugin initialized
   */
  recordInitialized(pluginName: string): void {
    const initStart = this.initStartTimes.get(pluginName);
    const initTime = initStart ? Date.now() - initStart : 0;

    const metrics = this.getOrCreateMetrics(pluginName);
    metrics.initTime = initTime;

    this.initStartTimes.delete(pluginName);
    this.invalidateCache();
    this.emitEvent("plugin:initialized", { pluginName, metrics });
  }

  /**
   * Record API call (optimized with single lookup and sampling)
   */
  recordAPICall(pluginName: string): void {
    if (!this.shouldSample()) return;

    const recordUpdate = () => {
      const metrics = this.getOrCreateMetrics(pluginName);
      metrics.apiCalls++;

      // Track timestamp for retention
      if (!this.apiCallTimestamps.has(pluginName)) {
        this.apiCallTimestamps.set(pluginName, new CircularBuffer<number>(1000));
      }
      this.apiCallTimestamps.get(pluginName)!.push(Date.now());

      this.applyRetention(pluginName);
      this.invalidateCache();
    };

    if (this.config.batching?.enabled) {
      this.updateQueue.push(recordUpdate);
      this.scheduleBatch();
    } else {
      recordUpdate();
    }
  }

  /**
   * Record error (optimized with single lookup)
   */
  recordError(pluginName: string, error: Error): void {
    const metrics = this.getOrCreateMetrics(pluginName);
    metrics.errors++;
    metrics.lastError = {
      message: error.message,
      timestamp: new Date(),
    };

    this.applyRetention(pluginName);
    this.invalidateCache();
    this.emitEvent("plugin:error", { pluginName, error, metrics });
  }

  /**
   * Create read-only snapshot of metrics
   */
  private createSnapshot(metrics: PluginMetrics): PluginMetrics {
    return Object.freeze({
      ...metrics,
      lastError: metrics.lastError
        ? Object.freeze({
            ...metrics.lastError,
            timestamp: new Date(metrics.lastError.timestamp),
          })
        : undefined,
      lastLoadTime: metrics.lastLoadTime
        ? new Date(metrics.lastLoadTime)
        : undefined,
    });
  }

  /**
   * Get metrics for a plugin (returns read-only snapshot)
   */
  getMetrics(pluginName: string): PluginMetrics | null {
    const metrics = this.metrics.get(pluginName);
    if (!metrics) return null;

    // Apply sampling scale if enabled
    const sampleScale = this.getSampleScale();
    const scaledMetrics: PluginMetrics = {
      ...metrics,
      apiCalls: Math.round(metrics.apiCalls * sampleScale),
    };

    return this.createSnapshot(scaledMetrics);
  }

  /**
   * Get all metrics (returns read-only snapshots)
   */
  getAllMetrics(): PluginMetrics[] {
    const sampleScale = this.getSampleScale();
    return Array.from(this.metrics.values()).map((m) => {
      const scaled: PluginMetrics = {
        ...m,
        apiCalls: Math.round(m.apiCalls * sampleScale),
      };
      return this.createSnapshot(scaled);
    });
  }

  /**
   * Clear metrics for a plugin
   */
  clearMetrics(pluginName: string): void {
    this.metrics.delete(pluginName);
    this.apiCallTimestamps.delete(pluginName);
    this.invalidateCache();
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.apiCallTimestamps.clear();
    this.invalidateCache();
  }

  /**
   * Get summary statistics (with caching)
   */
  getSummary(): SummaryStats {
    const now = Date.now();
    const cacheTTL = this.config.caching?.summaryCacheTTL || 1000;

    // Return cached summary if valid
    if (
      this.config.caching?.enabled &&
      this.summaryCache &&
      now - this.summaryCacheTime < cacheTTL
    ) {
      return this.summaryCache;
    }

    // Calculate summary
    const allMetrics = Array.from(this.metrics.values());
    const sampleScale = this.getSampleScale();

    const totalLoadTime = allMetrics.reduce((sum, m) => sum + m.loadTime, 0);
    const totalInitTime = allMetrics.reduce((sum, m) => sum + m.initTime, 0);
    const totalAPICalls = Math.round(
      allMetrics.reduce((sum, m) => sum + m.apiCalls, 0) * sampleScale
    );
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors, 0);

    const summary: SummaryStats = {
      totalPlugins: allMetrics.length,
      totalLoadTime,
      totalInitTime,
      totalAPICalls,
      totalErrors,
      averageLoadTime:
        allMetrics.length > 0 ? totalLoadTime / allMetrics.length : 0,
      averageInitTime:
        allMetrics.length > 0 ? totalInitTime / allMetrics.length : 0,
    };

    // Cache summary
    if (this.config.caching?.enabled) {
      this.summaryCache = summary;
      this.summaryCacheTime = now;
    }

    return summary;
  }

  /**
   * Get current configuration
   */
  getConfig(): MetricsConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const pluginMetricsCollector = new PluginMetricsCollector();

/**
 * Track plugin load time
 */
export function trackPluginLoad(pluginName: string): void {
  pluginMetricsCollector.startLoad(pluginName);
}

/**
 * Track plugin initialization
 */
export function trackPluginInit(pluginName: string): void {
  pluginMetricsCollector.startInit(pluginName);
}

/**
 * Record plugin loaded
 */
export function recordPluginLoaded(pluginName: string): void {
  pluginMetricsCollector.recordLoaded(pluginName);
}

/**
 * Record plugin initialized
 */
export function recordPluginInitialized(pluginName: string): void {
  pluginMetricsCollector.recordInitialized(pluginName);
}

/**
 * Record plugin API call
 */
export function recordPluginAPICall(pluginName: string): void {
  pluginMetricsCollector.recordAPICall(pluginName);
}

/**
 * Record plugin error
 */
export function recordPluginError(pluginName: string, error: Error): void {
  pluginMetricsCollector.recordError(pluginName, error);
}

