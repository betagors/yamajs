import { describe, it, expect } from "vitest";
import { postgresqlAdapter } from "./adapter.ts";
import type { DatabaseConfig } from "@yama/core";

describe("PostgreSQL Adapter", () => {
  const mockConfig: DatabaseConfig = {
    dialect: "postgresql",
    url: "postgresql://test:test@localhost:5432/testdb",
  };

  it("should have all required methods", () => {
    expect(postgresqlAdapter.init).toBeDefined();
    expect(postgresqlAdapter.getClient).toBeDefined();
    expect(postgresqlAdapter.getSQL).toBeDefined();
    expect(postgresqlAdapter.close).toBeDefined();
    expect(postgresqlAdapter.generateSchema).toBeDefined();
    expect(postgresqlAdapter.generateMigration).toBeDefined();
  });

  it("should throw error when getting client before init", () => {
    expect(() => {
      postgresqlAdapter.getClient();
    }).toThrow("Database not initialized");
  });

  it("should throw error when getting SQL before init", () => {
    expect(() => {
      postgresqlAdapter.getSQL?.();
    }).toThrow("Database not initialized");
  });

  // Note: Integration tests with actual database would go in a separate file
  // These are unit tests that verify the adapter structure
});

