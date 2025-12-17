/**
 * Configuration Module for Yama
 *
 * Provides T3-style environment validation and typed config access.
 */
export type { ConfigValueType, ConfigVarDefinition, ConfigVarShorthand, ConfigSchema, ConfigValidationError, ConfigValidationResult, ResolvedConfig, YamaConfigSection, ConfigSource, } from "./types.js";
export { validateConfig, validateConfigOrThrow, createConfigAccessor, } from "./validator.js";
export { loadConfig, loadConfigFromYaml, isConfigValid, getMissingConfig, getCurrentEnvironment, type ConfigLoaderOptions, } from "./loader.js";
//# sourceMappingURL=index.d.ts.map