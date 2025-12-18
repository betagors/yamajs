import type { CacheAdapter } from '@yamajs/kernel';

interface MemoryCacheEntry<T> {
    value: T;
    expiresAt?: number;
}

/**
 * In-memory cache adapter for local development/testing
 */
export class MemoryAdapter implements CacheAdapter {
    private store: Map<string, MemoryCacheEntry<any>>;
    private namespacePrefix: string;

    constructor(prefix: string = '') {
        this.store = new Map();
        this.namespacePrefix = prefix;
    }

    private getKey(key: string): string {
        return this.namespacePrefix ? `${this.namespacePrefix}:${key}` : key;
    }

    async get<T = unknown>(key: string): Promise<T | null> {
        const fullKey = this.getKey(key);
        const entry = this.store.get(fullKey);

        if (!entry) {
            return null;
        }

        // Check expiration
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.store.delete(fullKey);
            return null;
        }

        return entry.value as T;
    }

    async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const fullKey = this.getKey(key);
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;

        this.store.set(fullKey, { value, expiresAt });
    }

    async del(key: string): Promise<void> {
        const fullKey = this.getKey(key);
        this.store.delete(fullKey);
    }

    async exists(key: string): Promise<boolean> {
        return (await this.get(key)) !== null;
    }

    async health(): Promise<{ ok: boolean; latency?: number }> {
        return { ok: true, latency: 0 };
    }

    namespace(prefix: string): CacheAdapter {
        const newPrefix = this.namespacePrefix
            ? `${this.namespacePrefix}:${prefix}`
            : prefix;

        // Create new adapter sharing the same store!
        const namespaced = new MemoryAdapter(newPrefix);
        namespaced.store = this.store;
        return namespaced;
    }
}

/**
 * Factory for creating memory adapter
 */
export function createMemoryAdapter(config: any = {}): CacheAdapter {
    return new MemoryAdapter();
}
