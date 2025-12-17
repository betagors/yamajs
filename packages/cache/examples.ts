/**
 * @yamajs/cache Examples
 * 
 * This file demonstrates various usage patterns for the cache package.
 */

import { Cache } from '@yamajs/cache';
import { createMemoryAdapter } from '@yamajs/cache';

// Mock Redis adapter (since we don't have the package yet)
const createRedisAdapter = (config: any) => createMemoryAdapter();

// ============================================================
// Example 1: Basic Usage (In-Memory)
// ============================================================

async function basicUsage() {
    // 1. Create adapter (defaults to memory)
    const adapter = createMemoryAdapter();

    // 2. Create cache instance
    const cache = new Cache(adapter);

    // 3. Set a value with TTL (1 hour)
    await cache.set('current-user', { id: 1, name: 'Alice' }, 3600);

    // 4. Get a value
    const user = await cache.get('current-user');
    console.log('User:', user);

    // 5. Check if exists
    if (await cache.exists('current-user')) {
        console.log('User is cached');
    }

    // 6. Delete
    await cache.del('current-user');
}

// ============================================================
// Example 2: Redis Configuration
// ============================================================

async function redisUsage() {
    // In a real app, this comes from @yamajs/redis
    const adapter = createRedisAdapter({
        url: 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD
    });

    // Create cache with global prefix and default TTL
    const cache = new Cache(adapter, {
        prefix: 'my-app:',
        defaults: {
            ttl: 300 // 5 minutes default
        }
    });

    // Stores as "my-app:session:123" with 300s TTL
    await cache.set('session:123', { valid: true });

    // Override TTL: stores for 24 hours
    await cache.set('config:flags', { features: [] }, 86400);
}

// ============================================================
// Example 3: Hooks for Logging & Metrics
// ============================================================

async function hooksUsage() {
    const cache = new Cache(createMemoryAdapter());

    // Logging hook
    cache.on('before:set', async ({ key, value, ttl }) => {
        console.log(`[Cache] Setting ${key} (TTL: ${ttl}s)`);
    });

    // Metrics hook
    cache.on('after:get', async ({ key, result }) => {
        const status = result ? 'HIT' : 'MISS';
        console.log(`[Metrics] Cache ${status} for ${key}`);
        // metrics.increment(`cache.${status.toLowerCase()}`);
    });

    await cache.set('foo', 'bar');
    await cache.get('foo');
    await cache.get('missing');
}

// ============================================================
// Example 4: Namespacing
// ============================================================

async function namespacingExample() {
    const rootCache = new Cache(createMemoryAdapter());

    // Create isolated views
    const usersCache = rootCache.namespace('users');
    const postsCache = rootCache.namespace('posts');

    // Clean keys in code, prefixed in storage
    await usersCache.set('123', { name: 'Alice' }); // stored as "users:123"
    await postsCache.set('123', { title: 'Hello' }); // stored as "posts:123"

    // They don't collide
    const user = await usersCache.get('123');
    const post = await postsCache.get('123');
}

// ============================================================
// Example 5: Serialization Extension
// ============================================================

const serializationPlugin = {
    name: 'json-serializer',

    // Add custom helper method
    async setJSON(key: string, value: any) {
        const stringified = JSON.stringify(value);
        await this.set(key, stringified);
    },

    async getJSON(key: string) {
        const value = await this.get<string>(key);
        return value ? JSON.parse(value) : null;
    }
};

async function extensionExample() {
    const cache = new Cache(createMemoryAdapter());

    // Register extension
    cache.use(serializationPlugin);

    // Use new methods (need casting or module augmentation in real apps)
    await (cache as any).setJSON('complex', { a: 1, b: 2 });

    const val = await (cache as any).getJSON('complex');
    console.log(val); // { a: 1, b: 2 }
}

// ============================================================
// Example 6: Read-Through Pattern
// ============================================================

async function readThroughPattern() {
    const cache = new Cache(createMemoryAdapter());
    const db = { findUser: async (id: string) => ({ id, name: 'User ' + id }) };

    // Helper to wrap DB calls
    async function getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
        const cached = await cache.get<T>(key);
        if (cached) return cached;

        const fresh = await fetcher();
        await cache.set(key, fresh, ttl);
        return fresh;
    }

    // Usage
    const userId = '42';
    const user = await getOrSet(
        `user:${userId}`,
        () => db.findUser(userId),
        300
    );
}

// ============================================================
// Example 7: Yama Integration
// ============================================================

// This is how it works inside Yama
async function yamaIntegration() {
    // 1. Config comes from yama.yaml
    const yamaConfig = {
        cache: {
            provider: 'memory', // or 'redis'
            prefix: 'app:',
        }
    };

    // 2. Import factory
    const { createCacheFromConfig } = await import('@yamajs/cache');

    // 3. Create instance
    const cache = createCacheFromConfig(yamaConfig.cache as any);

    // 4. Use it
    await cache.set('ready', true);
}
