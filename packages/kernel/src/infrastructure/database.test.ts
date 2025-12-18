import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createDatabaseAdapter,
  registerDatabaseAdapter,
  type DatabaseAdapter,
  type DatabaseConnection,
} from "./database";
import type { DatabaseConfig } from "../entities";

describe("Database Adapter", () => {
  beforeEach(() => {
    // Clear any registered adapters before each test
    // Note: In a real implementation, you'd want to expose a clear function
  });

  it("should throw error for unsupported dialect", () => {
    const config: DatabaseConfig = {
      dialect: "postgresql",
      url: "postgresql://test",
    };

    expect(() => {
      createDatabaseAdapter("mysql", config);
    }).toThrow("Unsupported database dialect");
  });

  it("should create adapter for registered dialect", () => {
    const mockAdapter: DatabaseAdapter = {
      async init() {
        return { db: {}, sql: {} };
      },
      getClient() {
        return {};
      },
      async close() {},
    };

    registerDatabaseAdapter("testdb", () => mockAdapter);

    const config: DatabaseConfig = {
      dialect: "postgresql",
      url: "postgresql://test",
    };

    const adapter = createDatabaseAdapter("testdb", config);
    expect(adapter).toBe(mockAdapter);
  });

  it("should normalize dialect to lowercase", () => {
    const mockAdapter: DatabaseAdapter = {
      async init() {
        return { db: {}, sql: {} };
      },
      getClient() {
        return {};
      },
      async close() {},
    };

    registerDatabaseAdapter("testdb", () => mockAdapter);

    const config: DatabaseConfig = {
      dialect: "postgresql",
      url: "postgresql://test",
    };

    const adapter1 = createDatabaseAdapter("TESTDB", config);
    const adapter2 = createDatabaseAdapter("TestDb", config);
    expect(adapter1).toBe(mockAdapter);
    expect(adapter2).toBe(mockAdapter);
  });
});

