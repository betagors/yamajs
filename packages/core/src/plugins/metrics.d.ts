/**
 * Plugin metrics
 */
export interface PluginMetrics {
    pluginName: string;
    loadTime: number;
    initTime: number;
    apiCalls: number;
    errors: number;
    lastError?: {
        message: string;
        timestamp: Date;
    };
    lastLoadTime?: Date;
    memoryUsage?: number;
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
        maxAge?: number;
        maxMetrics?: number;
    };
    sampling?: {
        enabled: boolean;
        sampleRate?: number;
    };
    caching?: {
        enabled: boolean;
        summaryCacheTTL?: number;
    };
    batching?: {
        enabled: boolean;
        batchWindow?: number;
    };
}
/**
 * Metrics collector for plugins
 */
declare class PluginMetricsCollector {
    private metrics;
    private loadStartTimes;
    private initStartTimes;
    private config;
    private summaryCache;
    private summaryCacheTime;
    private updateQueue;
    private batchTimeout;
    private apiCallTimestamps;
    private eventListeners;
    /**
     * Configure the metrics collector
     */
    configure(config: Partial<MetricsConfig>): void;
    /**
     * Register event listener for plugin events
     */
    onPluginEvent(event: string, handler: Function): void;
    /**
     * Remove event listener
     */
    offPluginEvent(event: string, handler: Function): void;
    /**
     * Emit event to registered listeners
     */
    private emitEvent;
    /**
     * Invalidate summary cache
     */
    private invalidateCache;
    /**
     * Create default metrics for a plugin
     */
    private createDefaultMetrics;
    /**
     * Get or create metrics for a plugin (single lookup pattern)
     */
    private getOrCreateMetrics;
    /**
     * Apply retention policy
     */
    private applyRetention;
    /**
     * Schedule batch update
     */
    private scheduleBatch;
    /**
     * Check if metric should be sampled
     */
    private shouldSample;
    /**
     * Get sample scale factor
     */
    private getSampleScale;
    /**
     * Start tracking plugin load
     */
    startLoad(pluginName: string): void;
    /**
     * Start tracking plugin init
     */
    startInit(pluginName: string): void;
    /**
     * Record plugin loaded
     */
    recordLoaded(pluginName: string, trackMemory?: boolean): void;
    /**
     * Record plugin initialized
     */
    recordInitialized(pluginName: string): void;
    /**
     * Record API call (optimized with single lookup and sampling)
     */
    recordAPICall(pluginName: string): void;
    /**
     * Record error (optimized with single lookup)
     */
    recordError(pluginName: string, error: Error): void;
    /**
     * Create read-only snapshot of metrics
     */
    private createSnapshot;
    /**
     * Get metrics for a plugin (returns read-only snapshot)
     */
    getMetrics(pluginName: string): PluginMetrics | null;
    /**
     * Get all metrics (returns read-only snapshots)
     */
    getAllMetrics(): PluginMetrics[];
    /**
     * Clear metrics for a plugin
     */
    clearMetrics(pluginName: string): void;
    /**
     * Clear all metrics
     */
    clearAllMetrics(): void;
    /**
     * Get summary statistics (with caching)
     */
    getSummary(): SummaryStats;
    /**
     * Get current configuration
     */
    getConfig(): MetricsConfig;
}
export declare const pluginMetricsCollector: PluginMetricsCollector;
/**
 * Track plugin load time
 */
export declare function trackPluginLoad(pluginName: string): void;
/**
 * Track plugin initialization
 */
export declare function trackPluginInit(pluginName: string): void;
/**
 * Record plugin loaded
 */
export declare function recordPluginLoaded(pluginName: string): void;
/**
 * Record plugin initialized
 */
export declare function recordPluginInitialized(pluginName: string): void;
/**
 * Record plugin API call
 */
export declare function recordPluginAPICall(pluginName: string): void;
/**
 * Record plugin error
 */
export declare function recordPluginError(pluginName: string, error: Error): void;
export {};
