/**
 * Configuration Validator for Yama
 * 
 * Validates config values against schema definitions.
 * Provides T3-style "fail fast" validation at startup.
 */

import { getEnvProvider } from "../platform/env.js";
import type {
    ConfigSchema,
    ConfigVarDefinition,
    ConfigValidationResult,
    ConfigValidationError,
    ResolvedConfig,
    ConfigValueType,
} from "./types.js";

/**
 * Normalize shorthand definitions to full definitions
 */
function normalizeDefinition(def: ConfigVarDefinition | boolean): ConfigVarDefinition {
    if (typeof def === "boolean") {
        return { required: def, type: "string" };
    }
    return { type: "string", ...def };
}

/**
 * Coerce a string value to the target type
 */
function coerceValue(
    value: string,
    type: ConfigValueType
): string | number | boolean | null {
    switch (type) {
        case "string":
            return value;

        case "number": {
            const num = Number(value);
            if (isNaN(num)) {
                return null; // Invalid number
            }
            return num;
        }

        case "boolean": {
            const lower = value.toLowerCase();
            if (lower === "true" || lower === "1" || lower === "yes") {
                return true;
            }
            if (lower === "false" || lower === "0" || lower === "no") {
                return false;
            }
            return null; // Invalid boolean
        }

        case "url":
            try {
                new URL(value);
                return value;
            } catch {
                return null;
            }

        case "email":
            // Simple email validation
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return value;
            }
            return null;

        default:
            return value;
    }
}

/**
 * Validate format constraints
 */
function validateFormat(
    value: string,
    format: "url" | "email" | "uuid"
): boolean {
    switch (format) {
        case "url":
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }

        case "email":
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

        case "uuid":
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

        default:
            return true;
    }
}

/**
 * Validate configuration against a schema
 * 
 * @param schema - Configuration schema to validate against
 * @param sources - Optional map of pre-loaded values (for testing)
 * @returns Validation result with resolved config or errors
 */
export function validateConfig(
    schema: ConfigSchema,
    sources?: Record<string, string | undefined>
): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const resolved: ResolvedConfig = {};
    const env = getEnvProvider();

    for (const [key, rawDef] of Object.entries(schema)) {
        const def = normalizeDefinition(rawDef);
        const envVarName = def.envVar ?? key;

        // Get raw value from sources or environment
        let rawValue: string | undefined = sources?.[envVarName] ?? env.getEnv(envVarName);

        // Apply default if no value
        if (rawValue === undefined && def.default !== undefined) {
            rawValue = String(def.default);
        }

        // Check required
        if (rawValue === undefined || rawValue === "") {
            if (def.required) {
                errors.push({
                    key,
                    message: `Missing required config: ${key}${def.description ? ` (${def.description})` : ""}`,
                    expected: def.type ?? "string",
                });
            }
            continue;
        }

        // Coerce type
        const coerced = coerceValue(rawValue, def.type ?? "string");
        if (coerced === null) {
            errors.push({
                key,
                message: `Invalid type for ${key}: expected ${def.type}, got "${rawValue}"`,
                received: rawValue,
                expected: def.type,
            });
            continue;
        }

        // Validate enum
        if (def.enum && !def.enum.includes(coerced as string | number)) {
            errors.push({
                key,
                message: `Invalid value for ${key}: must be one of [${def.enum.join(", ")}], got "${coerced}"`,
                received: coerced,
                expected: `one of [${def.enum.join(", ")}]`,
            });
            continue;
        }

        // Validate format
        if (def.format && typeof coerced === "string" && !validateFormat(coerced, def.format)) {
            errors.push({
                key,
                message: `Invalid format for ${key}: expected ${def.format}`,
                received: coerced,
                expected: def.format,
            });
            continue;
        }

        // Store resolved value
        resolved[key] = coerced;
    }

    return {
        valid: errors.length === 0,
        errors,
        resolved,
    };
}

/**
 * Validate and throw on error (for startup)
 * 
 * @param schema - Configuration schema
 * @param context - Optional context for error messages
 * @throws Error with formatted message if validation fails
 */
export function validateConfigOrThrow(
    schema: ConfigSchema,
    context?: string
): ResolvedConfig {
    const result = validateConfig(schema);

    if (!result.valid) {
        const prefix = context ? `[${context}] ` : "";
        const errorList = result.errors
            .map((e) => `  ❌ ${e.message}`)
            .join("\n");

        throw new Error(
            `${prefix}Configuration validation failed:\n${errorList}\n\n` +
            `Tip: Check your .env file or environment variables.`
        );
    }

    return result.resolved;
}

/**
 * Create a typed config accessor from a schema
 * 
 * @param schema - Configuration schema
 * @returns Proxy object with typed access to config values
 */
export function createConfigAccessor<T extends Record<string, unknown>>(
    schema: ConfigSchema
): T {
    const result = validateConfigOrThrow(schema);
    return result as T;
}
