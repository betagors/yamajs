/**
 * Configuration Module for Yama
 *
 * Provides T3-style environment validation and typed config access.
 */
// Validation
export { validateConfig, validateConfigOrThrow, createConfigAccessor, } from "./validator.js";
// Loading
export { loadConfig, loadConfigFromYaml, isConfigValid, getMissingConfig, getCurrentEnvironment, } from "./loader.js";
//# sourceMappingURL=index.js.map