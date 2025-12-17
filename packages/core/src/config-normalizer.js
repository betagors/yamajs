/**
 * Normalize YAMA config to support both 'schemas' and 'entities' keys
 * 'schemas' takes precedence if both are present
 *
 * @param config Raw config object
 * @returns Normalized config with unified schemas
 */
export function normalizeConfig(config) {
    // 'schemas' takes precedence
    if (config.schemas) {
        return {
            schemas: config.schemas,
            sourceKey: 'schemas',
        };
    }
    // Fall back to 'entities' if 'schemas' not present
    if (config.entities) {
        return {
            schemas: config.entities,
            sourceKey: 'entities',
        };
    }
    // Neither present - return empty
    return {
        schemas: {},
        sourceKey: 'schemas',
    };
}
/**
 * Get schemas from config (supports both 'schemas' and 'entities')
 */
export function getSchemasFromConfig(config) {
    return normalizeConfig(config).schemas;
}
//# sourceMappingURL=config-normalizer.js.map