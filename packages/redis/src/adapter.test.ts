import { describe, it, expect, beforeEach, vi } from "vitest";
import { RedisAdapter } from "./adapter";
import type { RedisClient } from "./client";

describe("RedisAdapter", () => {
  let mockClient: RedisClient;
  let adapter: RedisAdapter;

  beforeEach(() => {
    // Create mock Redis client
    mockClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      ping: vi.fn().mockResolvedValue("PONG"),
      quit: vi.fn().mockResolvedValue(undefined),
    } as unknown as RedisClient;

    adapter = new RedisAdapter(mockClient);
  });

  describe("get", () => {
    it("should return null for non-existent keys", async () => {
      (mockClient.get as any).mockResolvedValue(null);
      const result = await adapter.get("nonexistent");
      expect(result).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith("nonexistent");
    });

    it("should return parsed JSON values", async () => {
      const value = JSON.stringify({ foo: "bar" });
      (mockClient.get as any).mockResolvedValue(value);
      const result = await adapter.get<{ foo: string }>("key");
      expect(result).toEqual({ foo: "bar" });
    });

    it("should return null for invalid JSON", async () => {
      (mockClient.get as any).mockResolvedValue("invalid json{");
      const result = await adapter.get("key");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("should serialize and store values", async () => {
      await adapter.set("key", { foo: "bar" });
      expect(mockClient.set).toHaveBeenCalledWith(
        "key",
        JSON.stringify({ foo: "bar" })
      );
    });

    it("should set without TTL when not provided", async () => {
      await adapter.set("key", "value");
      expect(mockClient.set).toHaveBeenCalledWith("key", JSON.stringify("value"));
    });

    it("should set with TTL when provided", async () => {
      await adapter.set("key", "value", 3600);
      expect(mockClient.set).toHaveBeenCalledWith(
        "key",
        JSON.stringify("value"),
        "EX",
        3600
      );
    });
  });

  describe("del", () => {
    it("should delete keys", async () => {
      await adapter.del("key");
      expect(mockClient.del).toHaveBeenCalledWith("key");
    });
  });

  describe("exists", () => {
    it("should return false when key does not exist", async () => {
      (mockClient.exists as any).mockResolvedValue(0);
      const result = await adapter.exists("key");
      expect(result).toBe(false);
      expect(mockClient.exists).toHaveBeenCalledWith("key");
    });

    it("should return true when key exists", async () => {
      (mockClient.exists as any).mockResolvedValue(1);
      const result = await adapter.exists("key");
      expect(result).toBe(true);
    });
  });

  describe("namespace", () => {
    it("should create namespaced adapter", () => {
      const namespaced = adapter.namespace("tenant:123");
      expect(namespaced).toBeDefined();
      expect(namespaced).not.toBe(adapter);
    });

    it("should prefix keys in namespaced adapter", async () => {
      const namespaced = adapter.namespace("tenant:123");
      await namespaced.set("key", "value");
      expect(mockClient.set).toHaveBeenCalledWith(
        "tenant:123:key",
        JSON.stringify("value")
      );
    });

    it("should support nested namespaces", async () => {
      const ns1 = adapter.namespace("tenant:1");
      if (!ns1.namespace) {
        throw new Error("Namespace method not available");
      }
      const ns2 = ns1.namespace("feature:cache");
      await ns2.set("key", "value");
      expect(mockClient.set).toHaveBeenCalledWith(
        "tenant:1:feature:cache:key",
        JSON.stringify("value")
      );
    });
  });

  describe("health", () => {
    it("should return health status with latency", async () => {
      const start = Date.now();
      (mockClient.ping as any).mockImplementation(() => {
        return Promise.resolve("PONG");
      });

      const health = await adapter.health();
      expect(health.ok).toBe(true);
      expect(health.latency).toBeDefined();
      expect(typeof health.latency).toBe("number");
      expect(health.latency!).toBeGreaterThanOrEqual(0);
    });

    it("should return false on ping failure", async () => {
      (mockClient.ping as any).mockRejectedValue(new Error("Connection failed"));
      const health = await adapter.health();
      expect(health.ok).toBe(false);
    });
  });
});

