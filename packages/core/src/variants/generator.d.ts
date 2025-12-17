import type { FieldType } from '../types/types.js';
import type { VariantConfig, VariantSchema, GlobalVariantDefaults } from './types.js';
/**
 * Variant Generator
 *
 * Generates variant schemas (create, update, response, etc.) from base schemas.
 * Supports field exclusion, picking, overriding, and partial types.
 */
export declare class VariantGenerator {
    /**
     * Generate a variant schema from a base schema
     */
    static generate(baseSchema: {
        fields: Record<string, FieldType>;
        computed?: Record<string, any>;
    }, variantConfig: VariantConfig, globalDefaults?: GlobalVariantDefaults, variantName?: string): VariantSchema;
    /**
     * Merge variant config with global defaults
     */
    private static mergeConfig;
    /**
     * Generate all variants for a schema
     */
    static generateAll(baseSchema: {
        fields: Record<string, FieldType>;
        computed?: Record<string, any>;
        variants?: Record<string, VariantConfig>;
    }, globalDefaults?: GlobalVariantDefaults): Record<string, VariantSchema>;
}
//# sourceMappingURL=generator.d.ts.map