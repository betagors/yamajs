/**
 * Configuration Validator for Yama
 *
 * Validates config values against schema definitions.
 * Provides T3-style "fail fast" validation at startup.
 */
import type { ConfigSchema, ConfigValidationResult, ResolvedConfig } from "./types.js";
/**
 * Validate configuration against a schema
 *
 * @param schema - Configuration schema to validate against
 * @param sources - Optional map of pre-loaded values (for testing)
 * @returns Validation result with resolved config or errors
 */
export declare function validateConfig(schema: ConfigSchema, sources?: Record<string, string | undefined>): ConfigValidationResult;
/**
 * Validate and throw on error (for startup)
 *
 * @param schema - Configuration schema
 * @param context - Optional context for error messages
 * @throws Error with formatted message if validation fails
 */
export declare function validateConfigOrThrow(schema: ConfigSchema, context?: string): ResolvedConfig;
/**
 * Create a typed config accessor from a schema
 *
 * @param schema - Configuration schema
 * @returns Proxy object with typed access to config values
 */
export declare function createConfigAccessor<T extends Record<string, unknown>>(schema: ConfigSchema): T;
//# sourceMappingURL=validator.d.ts.map