/**
 * Configuration Schema Types for Yama
 * 
 * Defines the structure for validating configuration values from:
 * - yama.yaml config section
 * - Environment variables
 * - .env files
 */

/**
 * Supported configuration value types
 */
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'url' | 'email';

/**
 * Definition for a single configuration variable
 */
export interface ConfigVarDefinition {
    /**
     * Whether this variable is required (default: false)
     */
    required?: boolean;

    /**
     * The expected type (default: 'string')
     */
    type?: ConfigValueType;

    /**
     * Default value if not provided
     */
    default?: string | number | boolean;

    /**
     * Allowed values (enum validation)
     */
    enum?: (string | number)[];

    /**
     * Format validation (url, email, uuid)
     */
    format?: 'url' | 'email' | 'uuid';

    /**
     * Human-readable description (for docs/errors)
     */
    description?: string;

    /**
     * Environment variable to read from (defaults to key name)
     */
    envVar?: string;
}

/**
 * Shorthand: `true` means required string, `false` means optional string
 */
export type ConfigVarShorthand = boolean;

/**
 * Configuration schema definition
 * Keys are config variable names, values are definitions or shorthands
 */
export type ConfigSchema = Record<string, ConfigVarDefinition | ConfigVarShorthand>;

/**
 * Validation error for a single config variable
 */
export interface ConfigValidationError {
    key: string;
    message: string;
    received?: unknown;
    expected?: string;
}

/**
 * Result of config validation
 */
export interface ConfigValidationResult {
    valid: boolean;
    errors: ConfigValidationError[];
    resolved: ResolvedConfig;
}

/**
 * Resolved configuration object with typed values
 */
export interface ResolvedConfig {
    [key: string]: string | number | boolean | undefined;
}

/**
 * Configuration section in yama.yaml
 */
export interface YamaConfigSection {
    /**
     * Schema for validating config variables
     */
    schema?: ConfigSchema;

    /**
     * Static values (not from env)
     */
    values?: Record<string, string | number | boolean>;
}

/**
 * Priority sources for config resolution (highest to lowest)
 */
export type ConfigSource =
    | 'cli'           // Command line flags
    | 'env'           // process.env
    | 'env-local'     // .env.local
    | 'env-specific'  // .env.{environment}
    | 'env-base'      // .env
    | 'yaml-specific' // yama.{environment}.yaml
    | 'yaml-base'     // yama.yaml values
    | 'default';      // Schema defaults
