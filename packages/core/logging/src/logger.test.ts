import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger, createTransports } from "./logger.js";
import type { LoggingPluginConfig, Transport, LogEntry } from "./types.js";
import { LogLevel } from "./types.js";

describe("Logger", () => {
  let logger: Logger;
  let mockTransport: Transport;

  beforeEach(() => {
    mockTransport = {
      write: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const config: LoggingPluginConfig = {
      level: "info",
    };

    logger = new Logger(config);
  });

  describe("constructor", () => {
    it("should create logger with default level", () => {
      const config: LoggingPluginConfig = {};
      const logger = new Logger(config);
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it("should create logger with specified level", () => {
      const config: LoggingPluginConfig = {
        level: "debug",
      };
      const logger = new Logger(config);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });

    it("should create logger with warn level", () => {
      const config: LoggingPluginConfig = {
        level: "warn",
      };
      const logger = new Logger(config);
      expect(logger.getLevel()).toBe(LogLevel.WARN);
    });

    it("should create logger with error level", () => {
      const config: LoggingPluginConfig = {
        level: "error",
      };
      const logger = new Logger(config);
      expect(logger.getLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe("addTransport", () => {
    it("should add transport to logger", () => {
      logger.addTransport(mockTransport);
      expect(logger.getTransports()).toHaveLength(1);
      expect(logger.getTransports()[0]).toBe(mockTransport);
    });

    it("should add multiple transports", () => {
      const transport2: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
      };

      logger.addTransport(mockTransport);
      logger.addTransport(transport2);

      expect(logger.getTransports()).toHaveLength(2);
    });
  });

  describe("removeTransport", () => {
    it("should remove transport from logger", () => {
      logger.addTransport(mockTransport);
      expect(logger.getTransports()).toHaveLength(1);

      logger.removeTransport(mockTransport);
      expect(logger.getTransports()).toHaveLength(0);
    });

    it("should not throw when removing non-existent transport", () => {
      const otherTransport: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
      };

      expect(() => logger.removeTransport(otherTransport)).not.toThrow();
    });
  });

  describe("setLevel", () => {
    it("should change log level", () => {
      logger.setLevel("debug");
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);

      logger.setLevel("warn");
      expect(logger.getLevel()).toBe(LogLevel.WARN);
    });
  });

  describe("debug", () => {
    it("should log debug message when level allows", async () => {
      logger.setLevel("debug");
      logger.addTransport(mockTransport);

      logger.debug("Debug message");

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.write).toHaveBeenCalled();
      const entry = (mockTransport.write as any).mock.calls[0][0] as LogEntry;
      expect(entry.level).toBe(LogLevel.DEBUG);
      expect(entry.message).toBe("Debug message");
    });

    it("should not log debug message when level is too high", async () => {
      logger.setLevel("info");
      logger.addTransport(mockTransport);

      logger.debug("Debug message");

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.write).not.toHaveBeenCalled();
    });

    it("should include metadata in debug log", async () => {
      logger.setLevel("debug");
      logger.addTransport(mockTransport);

      logger.debug("Debug message", { key: "value" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const entry = (mockTransport.write as any).mock.calls[0][0] as LogEntry;
      expect(entry.metadata).toEqual({ key: "value" });
    });
  });

  describe("info", () => {
    it("should log info message", async () => {
      logger.addTransport(mockTransport);

      logger.info("Info message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.write).toHaveBeenCalled();
      const entry = (mockTransport.write as any).mock.calls[0][0] as LogEntry;
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.message).toBe("Info message");
    });

    it("should not log info message when level is warn", async () => {
      logger.setLevel("warn");
      logger.addTransport(mockTransport);

      logger.info("Info message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.write).not.toHaveBeenCalled();
    });
  });

  describe("warn", () => {
    it("should log warn message", async () => {
      logger.addTransport(mockTransport);

      logger.warn("Warning message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.write).toHaveBeenCalled();
      const entry = (mockTransport.write as any).mock.calls[0][0] as LogEntry;
      expect(entry.level).toBe(LogLevel.WARN);
      expect(entry.message).toBe("Warning message");
    });

    it("should not log warn message when level is error", async () => {
      logger.setLevel("error");
      logger.addTransport(mockTransport);

      logger.warn("Warning message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.write).not.toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("should log error message", async () => {
      logger.addTransport(mockTransport);

      const error = new Error("Test error");
      logger.error("Error message", error);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.write).toHaveBeenCalled();
      const entry = (mockTransport.write as any).mock.calls[0][0] as LogEntry;
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.message).toBe("Error message");
      expect(entry.error).toBe(error);
    });

    it("should log error without error object", async () => {
      logger.addTransport(mockTransport);

      logger.error("Error message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      const entry = (mockTransport.write as any).mock.calls[0][0] as LogEntry;
      expect(entry.error).toBeUndefined();
    });

    it("should include metadata in error log", async () => {
      logger.addTransport(mockTransport);

      logger.error("Error message", undefined, { key: "value" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const entry = (mockTransport.write as any).mock.calls[0][0] as LogEntry;
      expect(entry.metadata).toEqual({ key: "value" });
    });
  });

  describe("flush", () => {
    it("should flush all transports", async () => {
      const transport2: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      logger.addTransport(mockTransport);
      logger.addTransport(transport2);

      await logger.flush();

      expect(mockTransport.flush).toHaveBeenCalled();
      expect(transport2.flush).toHaveBeenCalled();
    });

    it("should handle transports without flush method", async () => {
      const transportWithoutFlush: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
      };

      logger.addTransport(transportWithoutFlush);

      await expect(logger.flush()).resolves.not.toThrow();
    });

    it("should handle flush errors gracefully", async () => {
      const failingTransport: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
        flush: vi.fn().mockRejectedValue(new Error("Flush failed")),
      };

      logger.addTransport(failingTransport);

      // Should not throw
      await expect(logger.flush()).resolves.not.toThrow();
    });
  });

  describe("close", () => {
    it("should close all transports", async () => {
      const transport2: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      logger.addTransport(mockTransport);
      logger.addTransport(transport2);

      await logger.close();

      expect(mockTransport.close).toHaveBeenCalled();
      expect(transport2.close).toHaveBeenCalled();
    });

    it("should handle transports without close method", async () => {
      const transportWithoutClose: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
      };

      logger.addTransport(transportWithoutClose);

      await expect(logger.close()).resolves.not.toThrow();
    });

    it("should handle close errors gracefully", async () => {
      const failingTransport: Transport = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockRejectedValue(new Error("Close failed")),
      };

      logger.addTransport(failingTransport);

      await expect(logger.close()).resolves.not.toThrow();
    });
  });

  describe("createTransports", () => {
    it("should create default console transport when no transports specified", async () => {
      const config: LoggingPluginConfig = {};

      const transports = await createTransports(config);

      expect(transports).toHaveLength(1);
      expect(transports[0]).toBeDefined();
    });

    it("should create console transport from config", async () => {
      const config: LoggingPluginConfig = {
        transports: [
          {
            type: "console",
            format: "text",
          },
        ],
      };

      const transports = await createTransports(config);

      expect(transports).toHaveLength(1);
    });

    it("should handle transport creation errors gracefully", async () => {
      const config: LoggingPluginConfig = {
        transports: [
          {
            type: "file",
            path: "/invalid/path",
          } as any,
        ],
      };

      // Should not throw, but may create empty transports array or handle error
      const transports = await createTransports(config);

      // The function should handle errors and continue
      expect(Array.isArray(transports)).toBe(true);
    });
  });
});

