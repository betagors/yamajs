import { describe, it, expect } from "vitest";
import { sanitizeRequestData } from "./sanitization.js";
import type { SanitizationConfig } from "./types.js";

describe("Sanitization", () => {
  describe("sanitizeRequestData", () => {
    it("should return data unchanged when sanitization is disabled", () => {
      const config: SanitizationConfig = {
        enabled: false,
      };

      const data = {
        message: "<script>alert('xss')</script>",
        sql: "SELECT * FROM users",
      };

      const result = sanitizeRequestData(data, config);
      expect(result).toEqual(data);
    });

    it("should sanitize HTML tags", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
      };

      const data = {
        message: "<script>alert('xss')</script>Hello",
        safe: "No tags here",
      };

      const result = sanitizeRequestData(data, config);
      expect(result.message).toBe("alert('xss')Hello");
      expect(result.safe).toBe("No tags here");
    });

    it("should sanitize SQL injection patterns", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeSql: true,
      };

      const data = {
        query: "SELECT * FROM users; DROP TABLE users;",
        normal: "SELECT * FROM products",
      };

      const result = sanitizeRequestData(data, config);
      expect(result.query).not.toContain("SELECT");
      expect(result.query).not.toContain("DROP");
      expect(result.query).not.toContain(";");
    });

    it("should sanitize XSS patterns", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeXss: true,
      };

      const data = {
        input: "<script>alert('xss')</script>",
        onclick: "onclick=alert('xss')",
        javascript: "javascript:alert('xss')",
      };

      const result = sanitizeRequestData(data, config);
      expect(result.input).not.toContain("<script>");
      expect(result.onclick).not.toContain("onclick=");
      expect(result.javascript).not.toContain("javascript:");
    });

    it("should enforce max string length", () => {
      const config: SanitizationConfig = {
        enabled: true,
        maxStringLength: 10,
      };

      const data = {
        short: "short",
        long: "this is a very long string that should be truncated",
      };

      const result = sanitizeRequestData(data, config);
      expect(result.short).toBe("short");
      expect(result.long.length).toBe(10);
      expect(result.long).toBe("this is a ");
    });

    it("should sanitize nested objects", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
      };

      const data = {
        user: {
          name: "<script>alert('xss')</script>",
          email: "user@example.com",
          profile: {
            bio: "<iframe src='evil.com'></iframe>",
          },
        },
      };

      const result = sanitizeRequestData(data, config);
      expect(result.user.name).not.toContain("<script>");
      expect(result.user.email).toBe("user@example.com");
      expect(result.user.profile.bio).not.toContain("<iframe>");
    });

    it("should sanitize arrays", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
      };

      const data = {
        messages: [
          "<script>alert('xss')</script>",
          "Safe message",
          "<img src='x' onerror='alert(1)'>",
        ],
      };

      const result = sanitizeRequestData(data, config);
      expect(result.messages[0]).not.toContain("<script>");
      expect(result.messages[1]).toBe("Safe message");
      expect(result.messages[2]).not.toContain("onerror");
    });

    it("should preserve non-string values", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
      };

      const data = {
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined,
      };

      const result = sanitizeRequestData(data, config);
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.nullValue).toBe(null);
      expect(result.undefinedValue).toBe(undefined);
    });

    it("should exclude paths from sanitization", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
        excludePaths: ["/api/webhook", "/api/callback"],
      };

      const data = {
        message: "<script>alert('xss')</script>",
      };

      // Test excluded path
      const result1 = sanitizeRequestData(data, config, "/api/webhook");
      expect(result1.message).toContain("<script>");

      // Test non-excluded path
      const result2 = sanitizeRequestData(data, config, "/api/users");
      expect(result2.message).not.toContain("<script>");
    });

    it("should handle wildcard path exclusions", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
        excludePaths: ["/api/webhooks/*"],
      };

      const data = {
        message: "<script>alert('xss')</script>",
      };

      const result = sanitizeRequestData(data, config, "/api/webhooks/stripe");
      expect(result.message).toContain("<script>");
    });

    it("should apply all sanitization rules together", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
        sanitizeSql: true,
        sanitizeXss: true,
        maxStringLength: 50,
      };

      const data = {
        malicious: "<script>alert('xss')</script>SELECT * FROM users; DROP TABLE users;",
        long: "a".repeat(100),
      };

      const result = sanitizeRequestData(data, config);
      expect(result.malicious).not.toContain("<script>");
      expect(result.malicious).not.toContain("SELECT");
      expect(result.long.length).toBe(50);
    });

    it("should handle empty objects", () => {
      const config: SanitizationConfig = {
        enabled: true,
      };

      const data = {};

      const result = sanitizeRequestData(data, config);
      expect(result).toEqual({});
    });

    it("should handle empty strings", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
      };

      const data = {
        empty: "",
        normal: "test",
      };

      const result = sanitizeRequestData(data, config);
      expect(result.empty).toBe("");
      expect(result.normal).toBe("test");
    });

    it("should handle complex nested structures", () => {
      const config: SanitizationConfig = {
        enabled: true,
        sanitizeHtml: true,
      };

      const data = {
        users: [
          {
            name: "<script>alert('xss')</script>",
            tags: ["<b>tag</b>", "safe"],
          },
        ],
        metadata: {
          description: "<iframe src='evil.com'></iframe>",
        },
      };

      const result = sanitizeRequestData(data, config);
      expect(result.users[0].name).not.toContain("<script>");
      expect(result.users[0].tags[0]).not.toContain("<b>");
      expect(result.users[0].tags[1]).toBe("safe");
      expect(result.metadata.description).not.toContain("<iframe>");
    });
  });
});

