import type { RateLimitStore, RateLimitResult } from "./types.js";
/**
 * Redis client interface (to avoid requiring redis as a direct dependency)
 */
export interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
    eval(script: string, numKeys: number, ...keysAndArgs: (string | number)[]): Promise<unknown>;
    del(key: string): Promise<number>;
    zadd(key: string, score: number, member: string): Promise<number>;
    zremrangebyscore(key: string, min: number, max: number): Promise<number>;
    zcard(key: string): Promise<number>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    expire(key: string, seconds: number): Promise<number>;
    quit(): Promise<void>;
}
/**
 * Redis-based rate limit store using sliding window algorithm
 */
export declare class RedisRateLimitStore implements RateLimitStore {
    private client;
    private connected;
    constructor(client: RedisClient);
    /**
     * Check and increment rate limit for a key using sliding window
     * Uses Redis sorted sets to track request timestamps
     */
    checkAndIncrement(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
    /**
     * Cleanup is handled automatically by Redis expiration
     */
    cleanup(): Promise<void>;
}
/**
 * Create a Redis rate limit store
 * Attempts to dynamically import and create a Redis client
 */
export declare function createRedisRateLimitStore(config: any): Promise<RedisRateLimitStore>;
