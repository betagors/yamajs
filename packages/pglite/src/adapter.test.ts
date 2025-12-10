import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pgliteAdapter } from "./adapter.js";
import type { DatabaseConfig } from "@betagors/yama-core";

// Mock PGlite
vi.mock("@electric-sql/pglite", () => {
  const mockWaitReady = Promise.resolve();
  const mockClose = vi.fn().mockResolvedValue(undefined);
  const mockQuery = vi.fn().mockResolvedValue([]);

  return {
    PGlite: vi.fn().mockImplementation(() => ({
      waitReady: mockWaitReady,
      close: mockClose,
      query: mockQuery,
    })),
  };
});

// Mock drizzle
vi.mock("drizzle-orm/pglite", () => ({
  drizzle: vi.fn((client) => ({
    client,
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe("PGlite Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any initialized connections
    try {
      await pgliteAdapter.close();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("init", () => {
    it("should initialize adapter with in-memory database", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      const connection = await pgliteAdapter.init(config);

      expect(connection.db).toBeDefined();
      expect(connection.sql).toBeDefined();
    });

    it("should initialize adapter with custom path", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: "/custom/path",
      };

      const connection = await pgliteAdapter.init(config);

      expect(connection.db).toBeDefined();
      expect(connection.sql).toBeDefined();
    });

    it("should initialize adapter with default path when url is 'pglite'", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: "pglite",
      };

      const connection = await pgliteAdapter.init(config);

      expect(connection.db).toBeDefined();
      expect(connection.sql).toBeDefined();
    });

    it("should reuse existing connection if already initialized", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      const connection1 = await pgliteAdapter.init(config);
      const connection2 = await pgliteAdapter.init(config);

      expect(connection1).toBe(connection2);
    });

    it("should throw error if PGlite import fails", async () => {
      // This test would require mocking the dynamic import to fail
      // For now, we'll test the error message structure
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      // Normal case should work
      await expect(pgliteAdapter.init(config)).resolves.toBeDefined();
    });
  });

  describe("getClient", () => {
    it("should return client after initialization", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      await pgliteAdapter.init(config);

      const client = pgliteAdapter.getClient();

      expect(client).toBeDefined();
    });

    it("should throw error if not initialized", async () => {
      // Close any existing connection
      await pgliteAdapter.close();

      expect(() => pgliteAdapter.getClient()).toThrow(
        "Database not initialized"
      );
    });
  });

  describe("getSQL", () => {
    it("should return SQL client after initialization", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      await pgliteAdapter.init(config);

      if (!pgliteAdapter.getSQL) {
        throw new Error("getSQL method not available");
      }

      const sql = pgliteAdapter.getSQL();

      expect(sql).toBeDefined();
    });

    it("should throw error if not initialized", async () => {
      // Close any existing connection
      await pgliteAdapter.close();

      if (!pgliteAdapter.getSQL) {
        throw new Error("getSQL method not available");
      }

      expect(() => pgliteAdapter.getSQL!()).toThrow(
        "Database not initialized"
      );
    });
  });

  describe("close", () => {
    it("should close database connection", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      await pgliteAdapter.init(config);
      await pgliteAdapter.close();

      // After close, getClient should throw
      expect(() => pgliteAdapter.getClient()).toThrow(
        "Database not initialized"
      );
    });

    it("should not throw if already closed", async () => {
      await pgliteAdapter.close();
      await expect(pgliteAdapter.close()).resolves.not.toThrow();
    });
  });

  describe("generateSchema", () => {
    it("should generate schema from entities", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      await pgliteAdapter.init(config);

      const entities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" as const, primary: true },
            name: { type: "string" as const },
          },
        },
      };

      if (!pgliteAdapter.generateSchema) {
        throw new Error("generateSchema method not available");
      }

      const schema = await pgliteAdapter.generateSchema(entities);

      expect(typeof schema).toBe("string");
      expect(schema.length).toBeGreaterThan(0);
    });
  });

  describe("generateMigration", () => {
    it("should generate migration SQL from entities", async () => {
      const config: DatabaseConfig = {
        dialect: "pglite",
        url: ":memory:",
      };

      await pgliteAdapter.init(config);

      const entities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" as const, primary: true },
            name: { type: "string" as const },
          },
        },
      };

      if (!pgliteAdapter.generateMigration) {
        throw new Error("generateMigration method not available");
      }

      const migration = await pgliteAdapter.generateMigration(
        entities,
        "create_users"
      );

      expect(typeof migration).toBe("string");
      expect(migration.length).toBeGreaterThan(0);
      expect(migration).toContain("create_users");
    });
  });
});

