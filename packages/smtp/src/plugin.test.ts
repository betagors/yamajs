import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSMTPTransport, isMailpitConfig, type SMTPConfig } from "./client.js";
import { createEmailService, type EmailOptions } from "./service.js";
import plugin from "./plugin.js";
import type { PluginContext } from "@betagors/yama-core";

// Mock nodemailer
vi.mock("nodemailer", () => {
  const mockTransport = {
    sendMail: vi.fn(),
    verify: vi.fn(),
  };

  return {
    default: {
      createTransport: vi.fn(() => mockTransport),
    },
  };
});

describe("SMTP Plugin", () => {
  let mockContext: PluginContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      config: {},
      projectDir: "/test",
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      getPlugin: vi.fn(),
      getPluginAPI: vi.fn(),
      getPluginsByCategory: vi.fn(),
      registerService: vi.fn(),
      getService: vi.fn(),
      hasService: vi.fn(),
      getMiddlewareRegistry: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    };
  });

  describe("Mailpit Detection", () => {
    it("should detect Mailpit configuration", () => {
      const config: SMTPConfig = {
        host: "localhost",
        port: 1025,
      };
      expect(isMailpitConfig(config)).toBe(true);
    });

    it("should detect Mailpit with 127.0.0.1", () => {
      const config: SMTPConfig = {
        host: "127.0.0.1",
        port: 1025,
      };
      expect(isMailpitConfig(config)).toBe(true);
    });

    it("should not detect Mailpit for other hosts", () => {
      const config: SMTPConfig = {
        host: "smtp.example.com",
        port: 587,
      };
      expect(isMailpitConfig(config)).toBe(false);
    });

    it("should not detect Mailpit for other ports", () => {
      const config: SMTPConfig = {
        host: "localhost",
        port: 587,
      };
      expect(isMailpitConfig(config)).toBe(false);
    });
  });

  describe("SMTP Transport Creation", () => {
    it("should create transport for Mailpit", () => {
      const config: SMTPConfig = {
        host: "localhost",
        port: 1025,
        from: "test@example.com",
      };

      const transport = createSMTPTransport(config);
      expect(transport).toBeDefined();
    });

    it("should create transport for production SMTP", () => {
      const config: SMTPConfig = {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
          user: "user",
          pass: "pass",
        },
        from: "test@example.com",
      };

      const transport = createSMTPTransport(config);
      expect(transport).toBeDefined();
    });
  });

  describe("Email Service", () => {
    it("should send email", async () => {
      const mockTransport = {
        sendMail: vi.fn().mockResolvedValue({
          messageId: "test-id",
          accepted: ["test@example.com"],
          rejected: [],
          response: "250 OK",
        }),
      };

      const emailService = createEmailService(mockTransport as any, "noreply@example.com");

      const options: EmailOptions = {
        to: "test@example.com",
        subject: "Test",
        text: "Test message",
      };

      const result = await emailService.send(options);

      expect(result.messageId).toBe("test-id");
      expect(result.accepted).toContain("test@example.com");
      expect(mockTransport.sendMail).toHaveBeenCalled();
    });

    it("should send batch emails", async () => {
      const mockTransport = {
        sendMail: vi.fn().mockResolvedValue({
          messageId: "test-id",
          accepted: ["test@example.com"],
          rejected: [],
        }),
      };

      const emailService = createEmailService(mockTransport as any);

      const emails: EmailOptions[] = [
        { to: "user1@example.com", subject: "Test 1", text: "Message 1" },
        { to: "user2@example.com", subject: "Test 2", text: "Message 2" },
      ];

      const results = await emailService.sendBatch(emails);

      expect(results).toHaveLength(2);
      expect(mockTransport.sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe("Plugin Initialization", () => {
    it("should initialize plugin with valid config", async () => {
      const config: SMTPConfig = {
        host: "localhost",
        port: 1025,
        from: "noreply@example.com",
      };

      const api = await plugin.init(config, mockContext);

      expect(api).toBeDefined();
      expect(api.send).toBeDefined();
      expect(api.sendBatch).toBeDefined();
      expect(mockContext.registerService).toHaveBeenCalledWith("email", expect.any(Object));
    });

    it("should throw error if host is missing", async () => {
      const config = {} as SMTPConfig;

      await expect(plugin.init(config, mockContext)).rejects.toThrow("SMTP host is required");
    });

    it("should log Mailpit detection", async () => {
      const config: SMTPConfig = {
        host: "localhost",
        port: 1025,
        from: "noreply@example.com",
      };

      await plugin.init(config, mockContext);

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Mailpit")
      );
    });
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const result = await plugin.onHealthCheck?.();

      expect(result).toEqual({
        healthy: true,
        details: {
          service: "smtp",
        },
      });
    });
  });
});



















