import { describe, it, expect } from "vitest";
import type { CacheAdapter } from "./cache";

/**
 * Test suite for CacheAdapter interface contract
 * These tests verify that implementations follow the interface correctly
 */
describe("CacheAdapter interface", () => {
  /**
   * Mock implementation for testing interface contract
   */
  class MockCacheAdapter implements CacheAdapter {
    private store = new Map<string, { value: string; expires?: number }>();

    async get<T = unknown>(key: string): Promise<T | null> {
      const entry = this.store.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expires && entry.expires < Date.now()) {
        this.store.delete(key);
        return null;
      }
      return JSON.parse(entry.value) as T;
    }

    async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
      this.store.set(key, {
        value: JSON.stringify(value),
        expires,
      });
    }

    async del(key: string): Promise<void> {
      this.store.delete(key);
    }

    async exists(key: string): Promise<boolean> {
      const entry = this.store.get(key);
      if (!entry) {
        return false;
      }
      if (entry.expires && entry.expires < Date.now()) {
        this.store.delete(key);
        return false;
      }
      return true;
    }

    namespace(prefix: string): CacheAdapter {
      return new NamespacedCacheAdapter(this, prefix);
    }

    async health(): Promise<{ ok: boolean; latency?: number }> {
      return { ok: true, latency: 1 };
    }
  }

  class NamespacedCacheAdapter implements CacheAdapter {
    constructor(
      private parent: MockCacheAdapter,
      private prefix: string
    ) {}

    async get<T = unknown>(key: string): Promise<T | null> {
      return this.parent.get<T>(`${this.prefix}:${key}`);
    }

    async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      return this.parent.set(`${this.prefix}:${key}`, value, ttlSeconds);
    }

    async del(key: string): Promise<void> {
      return this.parent.del(`${this.prefix}:${key}`);
    }

    async exists(key: string): Promise<boolean> {
      return this.parent.exists(`${this.prefix}:${key}`);
    }

    namespace(prefix: string): CacheAdapter {
      return new NamespacedCacheAdapter(this.parent, `${this.prefix}:${prefix}`);
    }
  }

  let cache: CacheAdapter;

  beforeEach(() => {
    cache = new MockCacheAdapter();
  });

  describe("get", () => {
    it("should return null for non-existent keys", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should return cached values with correct type", async () => {
      await cache.set("string-key", "test-value");
      const result = await cache.get<string>("string-key");
      expect(result).toBe("test-value");

      await cache.set("number-key", 42);
      const result2 = await cache.get<number>("number-key");
      expect(result2).toBe(42);

      await cache.set("object-key", { foo: "bar" });
      const result3 = await cache.get<{ foo: string }>("object-key");
      expect(result3).toEqual({ foo: "bar" });
    });
  });

  describe("set", () => {
    it("should store values", async () => {
      await cache.set("key", "value");
      const result = await cache.get<string>("key");
      expect(result).toBe("value");
    });

    it("should overwrite existing values", async () => {
      await cache.set("key", "value1");
      await cache.set("key", "value2");
      const result = await cache.get<string>("key");
      expect(result).toBe("value2");
    });

    it("should support TTL", async () => {
      await cache.set("key", "value", 1);
      expect(await cache.exists("key")).toBe(true);
      
      // Wait for expiration (in real implementation, this would be handled by Redis)
      // For mock, we test the exists check handles expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(await cache.exists("key")).toBe(false);
    });
  });

  describe("del", () => {
    it("should delete keys", async () => {
      await cache.set("key", "value");
      expect(await cache.exists("key")).toBe(true);
      
      await cache.del("key");
      expect(await cache.exists("key")).toBe(false);
      expect(await cache.get("key")).toBeNull();
    });

    it("should not throw when deleting non-existent keys", async () => {
      await expect(cache.del("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("exists", () => {
    it("should return false for non-existent keys", async () => {
      expect(await cache.exists("nonexistent")).toBe(false);
    });

    it("should return true for existing keys", async () => {
      await cache.set("key", "value");
      expect(await cache.exists("key")).toBe(true);
    });
  });

  describe("namespace", () => {
    it("should create namespaced adapter", () => {
      const namespaced = cache.namespace("tenant:123");
      expect(namespaced).toBeDefined();
      expect(namespaced).not.toBe(cache);
    });

    it("should isolate namespaces", async () => {
      const ns1 = cache.namespace("tenant:1");
      const ns2 = cache.namespace("tenant:2");

      await ns1.set("key", "value1");
      await ns2.set("key", "value2");

      expect(await ns1.get<string>("key")).toBe("value1");
      expect(await ns2.get<string>("key")).toBe("value2");
    });

    it("should support nested namespaces", async () => {
      const ns1 = cache.namespace("tenant:1");
      const ns2 = ns1.namespace("feature:cache");

      await ns2.set("key", "value");
      expect(await ns2.get<string>("key")).toBe("value");
      expect(await ns1.get<string>("feature:cache:key")).toBe("value");
    });
  });

  describe("health", () => {
    it("should return health status", async () => {
      const health = await cache.health?.();
      expect(health).toBeDefined();
      expect(health?.ok).toBe(true);
    });

    it("should optionally include latency", async () => {
      const health = await cache.health?.();
      if (health) {
        // Latency is optional, but if present should be a number
        if ("latency" in health) {
          expect(typeof health.latency).toBe("number");
        }
      }
    });
  });
});

