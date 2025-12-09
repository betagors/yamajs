/**
 * Tests for Config Validator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateConfig, validateConfigOrThrow, createConfigAccessor } from "./validator.js";
import type { ConfigSchema } from "./types.js";

// Mock the env provider
vi.mock("../platform/env.js", () => ({
    getEnvProvider: () => ({
        getEnv: (key: string) => mockEnv[key],
        setEnv: (key: string, value: string) => { mockEnv[key] = value; },
        cwd: () => "/",
    }),
}));

let mockEnv: Record<string, string | undefined> = {};

beforeEach(() => {
    mockEnv = {};
});

describe("validateConfig", () => {
    it("validates required string variables", () => {
        const schema: ConfigSchema = {
            DATABASE_URL: { required: true },
        };

        // Missing required var
        const result1 = validateConfig(schema);
        expect(result1.valid).toBe(false);
        expect(result1.errors[0].key).toBe("DATABASE_URL");

        // With var set
        mockEnv.DATABASE_URL = "postgres://localhost/db";
        const result2 = validateConfig(schema);
        expect(result2.valid).toBe(true);
        expect(result2.resolved.DATABASE_URL).toBe("postgres://localhost/db");
    });

    it("applies default values", () => {
        const schema: ConfigSchema = {
            PORT: { type: "number", default: 3000 },
        };

        const result = validateConfig(schema);
        expect(result.valid).toBe(true);
        expect(result.resolved.PORT).toBe(3000);
    });

    it("coerces number types", () => {
        const schema: ConfigSchema = {
            PORT: { type: "number", required: true },
        };

        mockEnv.PORT = "8080";
        const result = validateConfig(schema);
        expect(result.valid).toBe(true);
        expect(result.resolved.PORT).toBe(8080);
        expect(typeof result.resolved.PORT).toBe("number");
    });

    it("coerces boolean types", () => {
        const schema: ConfigSchema = {
            DEBUG: { type: "boolean", required: true },
        };

        mockEnv.DEBUG = "true";
        const result = validateConfig(schema);
        expect(result.valid).toBe(true);
        expect(result.resolved.DEBUG).toBe(true);

        mockEnv.DEBUG = "false";
        const result2 = validateConfig(schema);
        expect(result2.resolved.DEBUG).toBe(false);
    });

    it("validates enum values", () => {
        const schema: ConfigSchema = {
            LOG_LEVEL: { enum: ["debug", "info", "warn", "error"], required: true },
        };

        mockEnv.LOG_LEVEL = "info";
        const result1 = validateConfig(schema);
        expect(result1.valid).toBe(true);

        mockEnv.LOG_LEVEL = "invalid";
        const result2 = validateConfig(schema);
        expect(result2.valid).toBe(false);
        expect(result2.errors[0].message).toContain("must be one of");
    });

    it("validates URL format", () => {
        const schema: ConfigSchema = {
            API_URL: { type: "url", required: true },
        };

        mockEnv.API_URL = "https://api.example.com";
        const result1 = validateConfig(schema);
        expect(result1.valid).toBe(true);

        mockEnv.API_URL = "not-a-url";
        const result2 = validateConfig(schema);
        expect(result2.valid).toBe(false);
    });

    it("validates email format", () => {
        const schema: ConfigSchema = {
            ADMIN_EMAIL: { format: "email", required: true },
        };

        mockEnv.ADMIN_EMAIL = "admin@example.com";
        const result1 = validateConfig(schema);
        expect(result1.valid).toBe(true);

        mockEnv.ADMIN_EMAIL = "not-an-email";
        const result2 = validateConfig(schema);
        expect(result2.valid).toBe(false);
    });

    it("supports shorthand boolean syntax", () => {
        const schema: ConfigSchema = {
            REQUIRED_VAR: true,  // shorthand for { required: true }
            OPTIONAL_VAR: false, // shorthand for { required: false }
        };

        // Missing required
        const result1 = validateConfig(schema);
        expect(result1.valid).toBe(false);

        // With required var
        mockEnv.REQUIRED_VAR = "value";
        const result2 = validateConfig(schema);
        expect(result2.valid).toBe(true);
    });
});

describe("validateConfigOrThrow", () => {
    it("throws with formatted error message", () => {
        const schema: ConfigSchema = {
            DATABASE_URL: { required: true, description: "Postgres connection string" },
        };

        expect(() => validateConfigOrThrow(schema)).toThrow("Configuration validation failed");
        expect(() => validateConfigOrThrow(schema)).toThrow("DATABASE_URL");
    });

    it("returns resolved config on success", () => {
        const schema: ConfigSchema = {
            PORT: { type: "number", default: 3000 },
        };

        const config = validateConfigOrThrow(schema);
        expect(config.PORT).toBe(3000);
    });
});

describe("createConfigAccessor", () => {
    it("creates typed accessor", () => {
        const schema: ConfigSchema = {
            PORT: { type: "number", default: 3000 },
            DEBUG: { type: "boolean", default: false },
        };

        interface MyConfig {
            PORT: number;
            DEBUG: boolean;
        }

        const config = createConfigAccessor<MyConfig>(schema);
        expect(config.PORT).toBe(3000);
        expect(config.DEBUG).toBe(false);
    });
});
