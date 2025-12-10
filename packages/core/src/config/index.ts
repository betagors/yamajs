/**
 * Configuration Module for Yama
 * 
 * Provides T3-style environment validation and typed config access.
 */

// Types
export type {
    ConfigValueType,
    ConfigVarDefinition,
    ConfigVarShorthand,
    ConfigSchema,
    ConfigValidationError,
    ConfigValidationResult,
    ResolvedConfig,
    YamaConfigSection,
    ConfigSource,
} from "./types.js";

// Validation
export {
    validateConfig,
    validateConfigOrThrow,
    createConfigAccessor,
} from "./validator.js";

// Loading
export {
    loadConfig,
    loadConfigFromYaml,
    isConfigValid,
    getMissingConfig,
    getCurrentEnvironment,
    type ConfigLoaderOptions,
} from "./loader.js";
