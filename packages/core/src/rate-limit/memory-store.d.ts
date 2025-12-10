import type { RateLimitStore, RateLimitResult } from "./types.js";
/**
 * In-memory rate limit store using sliding window algorithm
 */
export declare class MemoryRateLimitStore implements RateLimitStore {
    private windows;
    private cleanupInterval;
    private cleanupTimer?;
    /**
     * @param cleanupIntervalMs - How often to run cleanup (default: 5 minutes)
     */
    constructor(cleanupIntervalMs?: number);
    /**
     * Check and increment rate limit for a key using sliding window
     */
    checkAndIncrement(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
    /**
     * Get or create a request window for a key
     */
    private getOrCreateWindow;
    /**
     * Cleanup expired windows
     */
    cleanup(): void;
    /**
     * Start periodic cleanup
     */
    private startCleanup;
    /**
     * Stop cleanup timer (useful for testing or shutdown)
     */
    stopCleanup(): void;
}
/**
 * Create a new in-memory rate limit store
 */
export declare function createMemoryRateLimitStore(cleanupIntervalMs?: number): MemoryRateLimitStore;
