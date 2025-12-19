import { describe, it, expect } from "vitest";
import { formatText, formatJSON, formatLogEntry } from "./formatters.js";
import type { LogEntry } from "./types.js";
import { LogLevel } from "./types.js";

describe("Log Formatters", () => {
  const createLogEntry = (
    overrides?: Partial<LogEntry>
  ): LogEntry => ({
    timestamp: new Date("2024-01-01T12:00:00Z"),
    level: LogLevel.INFO,
    levelName: "INFO",
    message: "Test message",
    ...overrides,
  });

  describe("formatText", () => {
    it("should format basic log entry", () => {
      const entry = createLogEntry();

      const formatted = formatText(entry);

      expect(formatted).toContain("2024-01-01T12:00:00.000Z");
      expect(formatted).toContain("INFO");
      expect(formatted).toContain("Test message");
    });

    it("should include metadata in text format", () => {
      const entry = createLogEntry({
        metadata: { key: "value", number: 42 },
      });

      const formatted = formatText(entry);

      expect(formatted).toContain("Test message");
      expect(formatted).toContain('"key":"value"');
      expect(formatted).toContain('"number":42');
    });

    it("should include error details in text format", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";
      const entry = createLogEntry({
        error,
      });

      const formatted = formatText(entry);

      expect(formatted).toContain("Test message");
      expect(formatted).toContain("Error: Test error");
      expect(formatted).toContain("Error: Test error");
      expect(formatted).toContain("at test.js:1:1");
    });

    it("should handle entry without metadata or error", () => {
      const entry = createLogEntry();

      const formatted = formatText(entry);

      expect(formatted).toBeTruthy();
      expect(formatted).toContain("Test message");
    });

    it("should format different log levels", () => {
      const debugEntry = createLogEntry({
        level: LogLevel.DEBUG,
        levelName: "DEBUG",
      });
      const errorEntry = createLogEntry({
        level: LogLevel.ERROR,
        levelName: "ERROR",
      });

      const debugFormatted = formatText(debugEntry);
      const errorFormatted = formatText(errorEntry);

      expect(debugFormatted).toContain("DEBUG");
      expect(errorFormatted).toContain("ERROR");
    });
  });

  describe("formatJSON", () => {
    it("should format basic log entry as JSON", () => {
      const entry = createLogEntry();

      const formatted = formatJSON(entry);
      const parsed = JSON.parse(formatted);

      expect(parsed.timestamp).toBe("2024-01-01T12:00:00.000Z");
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Test message");
    });

    it("should include metadata in JSON format", () => {
      const entry = createLogEntry({
        metadata: { key: "value", nested: { data: 123 } },
      });

      const formatted = formatJSON(entry);
      const parsed = JSON.parse(formatted);

      expect(parsed.metadata).toEqual({ key: "value", nested: { data: 123 } });
    });

    it("should include error details in JSON format", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";
      const entry = createLogEntry({
        error,
      });

      const formatted = formatJSON(entry);
      const parsed = JSON.parse(formatted);

      expect(parsed.error).toBeDefined();
      expect(parsed.error.message).toBe("Test error");
      expect(parsed.error.name).toBe("Error");
      // Stack is now an array of stack frames for easier processing
      expect(Array.isArray(parsed.error.stack)).toBe(true);
      expect(parsed.error.stack).toContain("at test.js:1:1");
    });

    it("should handle entry without metadata or error", () => {
      const entry = createLogEntry();

      const formatted = formatJSON(entry);
      const parsed = JSON.parse(formatted);

      expect(parsed.metadata).toBeUndefined();
      expect(parsed.error).toBeUndefined();
    });

    it("should format different log levels in JSON", () => {
      const debugEntry = createLogEntry({
        level: LogLevel.DEBUG,
        levelName: "DEBUG",
      });
      const errorEntry = createLogEntry({
        level: LogLevel.ERROR,
        levelName: "ERROR",
      });

      const debugFormatted = formatJSON(debugEntry);
      const errorFormatted = formatJSON(errorEntry);

      expect(JSON.parse(debugFormatted).level).toBe("debug");
      expect(JSON.parse(errorFormatted).level).toBe("error");
    });
  });

  describe("formatLogEntry", () => {
    it("should format as JSON when format is json", () => {
      const entry = createLogEntry();

      const formatted = formatLogEntry(entry, "json");
      const parsed = JSON.parse(formatted);

      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Test message");
    });

    it("should format as text when format is text", () => {
      const entry = createLogEntry();

      const formatted = formatLogEntry(entry, "text");

      expect(formatted).toContain("INFO");
      expect(formatted).toContain("Test message");
      expect(formatted).not.toContain('"level"');
    });

    it("should handle entries with metadata in both formats", () => {
      const entry = createLogEntry({
        metadata: { test: "data" },
      });

      const jsonFormatted = formatLogEntry(entry, "json");
      const textFormatted = formatLogEntry(entry, "text");

      expect(JSON.parse(jsonFormatted).metadata).toEqual({ test: "data" });
      expect(textFormatted).toContain("data");
    });

    it("should handle entries with errors in both formats", () => {
      const error = new Error("Test error");
      const entry = createLogEntry({ error });

      const jsonFormatted = formatLogEntry(entry, "json");
      const textFormatted = formatLogEntry(entry, "text");

      expect(JSON.parse(jsonFormatted).error).toBeDefined();
      expect(textFormatted).toContain("Error: Test error");
    });
  });
});

