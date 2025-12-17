import { TypeParser } from '../types/parser.js';
/**
 * Variant Generator
 *
 * Generates variant schemas (create, update, response, etc.) from base schemas.
 * Supports field exclusion, picking, overriding, and partial types.
 */
export class VariantGenerator {
    /**
     * Generate a variant schema from a base schema
     */
    static generate(baseSchema, variantConfig, globalDefaults, variantName) {
        // Merge global defaults with variant config
        const mergedConfig = this.mergeConfig(variantConfig, globalDefaults, variantName);
        let variantFields = { ...baseSchema.fields };
        // Apply pick (if specified, only include these fields)
        if (mergedConfig.pick && mergedConfig.pick.length > 0) {
            const pickedFields = {};
            for (const fieldName of mergedConfig.pick) {
                if (variantFields[fieldName]) {
                    pickedFields[fieldName] = variantFields[fieldName];
                }
            }
            variantFields = pickedFields;
        }
        // Apply exclude
        if (mergedConfig.exclude) {
            for (const fieldName of mergedConfig.exclude) {
                delete variantFields[fieldName];
            }
        }
        // Apply overrides
        if (mergedConfig.override) {
            for (const [fieldName, overrideDef] of Object.entries(mergedConfig.override)) {
                if (typeof overrideDef === 'string') {
                    // Parse string definition using TypeParser
                    const parsedOverride = TypeParser.parse(overrideDef);
                    variantFields[fieldName] = parsedOverride;
                }
                else {
                    // Use provided FieldType
                    variantFields[fieldName] = overrideDef;
                }
            }
        }
        // Apply partial (make all fields optional)
        if (mergedConfig.partial) {
            for (const fieldName of Object.keys(variantFields)) {
                variantFields[fieldName] = {
                    ...variantFields[fieldName],
                    nullable: true,
                };
            }
        }
        // Build result
        const result = {
            fields: variantFields,
        };
        // Include computed fields if specified
        if (mergedConfig.include && baseSchema.computed) {
            result.computed = {};
            for (const computedName of mergedConfig.include) {
                if (baseSchema.computed[computedName]) {
                    result.computed[computedName] = baseSchema.computed[computedName];
                }
            }
        }
        return result;
    }
    /**
     * Merge variant config with global defaults
     */
    static mergeConfig(variantConfig, globalDefaults, variantName) {
        if (!globalDefaults) {
            return variantConfig;
        }
        // Get global default for this variant name if provided
        const globalDefault = variantName ? globalDefaults[variantName] : undefined;
        if (!globalDefault) {
            return variantConfig;
        }
        // Merge: global defaults first, then variant config overrides
        return {
            exclude: [
                ...(globalDefault.exclude || []),
                ...(variantConfig.exclude || []),
            ],
            pick: variantConfig.pick || globalDefault.pick,
            override: {
                ...(globalDefault.override || {}),
                ...(variantConfig.override || {}),
            },
            partial: variantConfig.partial !== undefined ? variantConfig.partial : globalDefault.partial,
            include: [
                ...(globalDefault.include || []),
                ...(variantConfig.include || []),
            ],
        };
    }
    /**
     * Generate all variants for a schema
     */
    static generateAll(baseSchema, globalDefaults) {
        const results = {};
        if (!baseSchema.variants) {
            return results;
        }
        for (const [variantName, variantConfig] of Object.entries(baseSchema.variants)) {
            results[variantName] = this.generate(baseSchema, variantConfig, globalDefaults, variantName);
        }
        return results;
    }
}
//# sourceMappingURL=generator.js.map