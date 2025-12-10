/**
 * In-memory rate limit store using sliding window algorithm
 */
export class MemoryRateLimitStore {
    /**
     * @param cleanupIntervalMs - How often to run cleanup (default: 5 minutes)
     */
    constructor(cleanupIntervalMs = 5 * 60 * 1000) {
        this.windows = new Map();
        this.cleanupInterval = cleanupIntervalMs;
        this.startCleanup();
    }
    /**
     * Check and increment rate limit for a key using sliding window
     */
    async checkAndIncrement(key, maxRequests, windowMs) {
        const now = Date.now();
        const window = this.getOrCreateWindow(key);
        // Remove timestamps outside the current window
        const windowStart = now - windowMs;
        window.timestamps = window.timestamps.filter((ts) => ts > windowStart);
        // Check if limit exceeded
        const currentCount = window.timestamps.length;
        const allowed = currentCount < maxRequests;
        if (allowed) {
            // Add current request timestamp
            window.timestamps.push(now);
        }
        // Calculate reset time (when the oldest request in window expires)
        const oldestTimestamp = window.timestamps.length > 0
            ? Math.min(...window.timestamps)
            : now;
        const reset = Math.ceil((oldestTimestamp + windowMs) / 1000); // Convert to seconds
        const resetAfter = Math.max(0, (oldestTimestamp + windowMs) - now);
        return {
            allowed,
            remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
            limit: maxRequests,
            reset,
            resetAfter,
        };
    }
    /**
     * Get or create a request window for a key
     */
    getOrCreateWindow(key) {
        if (!this.windows.has(key)) {
            this.windows.set(key, {
                timestamps: [],
                lastCleanup: Date.now(),
            });
        }
        return this.windows.get(key);
    }
    /**
     * Cleanup expired windows
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, window] of this.windows.entries()) {
            // Remove timestamps older than any reasonable window (1 hour)
            const maxAge = 60 * 60 * 1000;
            const oldestTimestamp = window.timestamps.length > 0
                ? Math.min(...window.timestamps)
                : window.lastCleanup;
            // If window is empty and hasn't been used recently, delete it
            if (window.timestamps.length === 0 && (now - oldestTimestamp) > maxAge) {
                keysToDelete.push(key);
            }
            else {
                // Clean up old timestamps
                window.timestamps = window.timestamps.filter((ts) => (now - ts) <= maxAge);
            }
        }
        // Delete empty/expired windows
        for (const key of keysToDelete) {
            this.windows.delete(key);
        }
    }
    /**
     * Start periodic cleanup
     */
    startCleanup() {
        if (this.cleanupInterval > 0) {
            this.cleanupTimer = setInterval(() => {
                this.cleanup();
            }, this.cleanupInterval);
        }
    }
    /**
     * Stop cleanup timer (useful for testing or shutdown)
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
}
/**
 * Create a new in-memory rate limit store
 */
export function createMemoryRateLimitStore(cleanupIntervalMs) {
    return new MemoryRateLimitStore(cleanupIntervalMs);
}
//# sourceMappingURL=memory-store.js.map