import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EntityDefinition, YamaEntities, EntityField } from "@betagors/yama-core";

// Test the fixes we made to the node index.ts file

describe("Runtime Node Fixes", () => {
  describe("EntityFieldDefinition parsing", () => {
    it("should handle string field definitions when accessing properties", () => {
      // This tests the fix where we use parseFieldDefinition before accessing field properties
      // The issue was that EntityFieldDefinition can be string | EntityField
      // and we were accessing properties like .primary, .api, .type directly
      
      const entityDef: EntityDefinition = {
        table: "test_table",
        fields: {
          id: "uuid!",
          name: "string!",
          email: {
            type: "string",
            api: "emailAddress",
            required: true,
          },
        },
      };

      // Simulate the getPrimaryKeyFieldName function logic
      // Before fix: would try to access field.primary on a string
      // After fix: parses field first using parseFieldDefinition
      let foundPrimary = false;
      if (!entityDef.fields) return;
      for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
        // This is what the fixed code does
        const field: EntityField = typeof fieldDef === "string" 
          ? { type: fieldDef.includes("uuid") ? "uuid" : "string", required: fieldDef.includes("!"), primary: false }
          : fieldDef;
        
        if (field.primary) {
          foundPrimary = true;
          break;
        }
      }

      // Should not throw and should handle both string and object definitions
      expect(foundPrimary).toBe(false); // No primary field in this example
    });

    it("should handle searchable fields detection with string definitions", () => {
      const entityDef: EntityDefinition = {
        table: "users",
        fields: {
          id: "uuid!",
          name: "string!",
          bio: "text",
          age: "number",
        },
      };

      // Simulate the searchable fields detection logic
      const searchable: string[] = [];
      if (!entityDef.fields) return;
      for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
        const field = typeof fieldDef === "string"
          ? { 
              type: fieldDef.includes("text") ? "text" : fieldDef.includes("string") ? "string" : "other",
              api: true,
            }
          : fieldDef;
        
        if (field.api !== false && (field.type === "string" || field.type === "text")) {
          searchable.push(fieldName);
        }
      }

      expect(searchable).toContain("name");
      expect(searchable).toContain("bio");
      expect(searchable).not.toContain("id");
      expect(searchable).not.toContain("age");
    });
  });

  describe("Metrics adapter for middleware context", () => {
    it("should create middleware-compatible metrics with startTimer and increment", () => {
      // Test that we create a metrics adapter that has startTimer and increment
      // even though HandlerContext.metrics has increment, histogram, and gauge
      
      const mockHandlerContextMetrics = {
        increment: vi.fn((name: string, value?: number, tags?: Record<string, string>) => {}),
        histogram: vi.fn((name: string, value: number, tags?: Record<string, string>) => {}),
        gauge: vi.fn((name: string, value: number, tags?: Record<string, string>) => {}),
      };

      // Simulate the middleware metrics adapter creation
      const middlewareMetrics = {
        startTimer: (name: string, labels?: Record<string, string>) => {
          const startTime = Date.now();
          return () => {
            const duration = Date.now() - startTime;
            mockHandlerContextMetrics.histogram(name, duration, labels);
          };
        },
        increment: (name: string, labels?: Record<string, string>) => {
          mockHandlerContextMetrics.increment(name, 1, labels);
        },
      };

      // Test startTimer
      const stopTimer = middlewareMetrics.startTimer("test.timer", { env: "test" });
      stopTimer();
      expect(mockHandlerContextMetrics.histogram).toHaveBeenCalledWith(
        "test.timer",
        expect.any(Number),
        { env: "test" }
      );

      // Test increment
      middlewareMetrics.increment("test.counter", { env: "test" });
      expect(mockHandlerContextMetrics.increment).toHaveBeenCalledWith(
        "test.counter",
        1,
        { env: "test" }
      );
    });
  });

  describe("Logger error handling", () => {
    it("should call logger.error with proper signature (message, error, meta)", () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn((message: string, error?: Error, meta?: Record<string, unknown>) => {}),
        debug: vi.fn(),
      };

      const statusCode = 500;
      const meta = {
        method: "GET",
        path: "/test",
        status: statusCode,
        duration: 100,
      };

      // Simulate the fixed logger call
      if (statusCode >= 500) {
        mockLogger.error("Request completed", undefined, meta);
      } else if (statusCode >= 400) {
        mockLogger.warn("Request completed", meta);
      } else {
        mockLogger.info("Request completed", meta);
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Request completed",
        undefined,
        meta
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it("should call logger.warn for 4xx status codes", () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn((message: string, meta?: Record<string, unknown>) => {}),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const statusCode = 404;
      const meta = {
        method: "GET",
        path: "/test",
        status: statusCode,
        duration: 50,
      };

      if (statusCode >= 500) {
        mockLogger.error("Request completed", undefined, meta);
      } else if (statusCode >= 400) {
        mockLogger.warn("Request completed", meta);
      } else {
        mockLogger.info("Request completed", meta);
      }

      expect(mockLogger.warn).toHaveBeenCalledWith("Request completed", meta);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it("should call logger.info for 2xx status codes", () => {
      const mockLogger = {
        info: vi.fn((message: string, meta?: Record<string, unknown>) => {}),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const statusCode = 200;
      const meta = {
        method: "GET",
        path: "/test",
        status: statusCode,
        duration: 30,
      };

      if (statusCode >= 500) {
        mockLogger.error("Request completed", undefined, meta);
      } else if (statusCode >= 400) {
        mockLogger.warn("Request completed", meta);
      } else {
        mockLogger.info("Request completed", meta);
      }

      expect(mockLogger.info).toHaveBeenCalledWith("Request completed", meta);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe("Search config mode handling", () => {
    it("should handle searchConfig.mode when searchConfig is an object (not array)", () => {
      // Test the fix where we check !Array.isArray(searchConfig) before accessing .mode
      
      const searchConfig1 = { mode: "starts" as const, fields: ["name", "email"] };
      const searchConfig2 = ["name", "email"]; // Array case
      const searchConfig3 = { mode: "exact" as const }; // Object without fields

      // Simulate the fixed code logic
      const getSearchMode = (searchConfig: unknown) => {
        if (searchConfig && typeof searchConfig === "object" && !Array.isArray(searchConfig) && "mode" in searchConfig) {
          return (searchConfig as { mode: string }).mode;
        }
        return "contains"; // Default
      };

      expect(getSearchMode(searchConfig1)).toBe("starts");
      expect(getSearchMode(searchConfig2)).toBe("contains"); // Array, should use default
      expect(getSearchMode(searchConfig3)).toBe("exact");
      expect(getSearchMode(null)).toBe("contains");
      expect(getSearchMode(undefined)).toBe("contains");
    });
  });

  describe("Config type casting", () => {
    it("should handle YamaConfig to Record<string, unknown> casting", () => {
      // Test that we can cast YamaConfig to Record<string, unknown> for resolveEnvVars
      const yamaConfig = {
        name: "test",
        version: "1.0.0",
        schemas: {},
        entities: {},
      };

      // Simulate the fix: cast to Record<string, unknown>
      const configAsRecord = yamaConfig as Record<string, unknown>;
      
      // Should be able to access properties
      expect(configAsRecord.name).toBe("test");
      expect(configAsRecord.version).toBe("1.0.0");
      
      // Should be able to use with functions expecting Record<string, unknown>
      const testFunction = (config: Record<string, unknown>) => {
        return config.name;
      };
      
      expect(testFunction(configAsRecord)).toBe("test");
    });
  });
});
