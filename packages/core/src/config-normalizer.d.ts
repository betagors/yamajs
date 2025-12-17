import type { YamaEntities, EntityDefinition } from './entities';
import type { YamaSchemas, SchemaDefinition } from './schemas';
/**
 * Unified schema/entity definition
 * Entities and schemas are the same concept
 */
export type UnifiedSchema = EntityDefinition | SchemaDefinition;
/**
 * Unified schemas collection
 */
export type UnifiedSchemas = Record<string, UnifiedSchema>;
/**
 * Normalized config with unified schemas/entities
 * Treats 'schemas' and 'entities' as aliases - 'schemas' takes precedence
 */
export interface NormalizedYamaConfig {
    /** Unified schemas (from 'schemas' or 'entities' key) */
    schemas: UnifiedSchemas;
    /** Original key used ('schemas' or 'entities') */
    sourceKey: 'schemas' | 'entities';
}
/**
 * Normalize YAMA config to support both 'schemas' and 'entities' keys
 * 'schemas' takes precedence if both are present
 *
 * @param config Raw config object
 * @returns Normalized config with unified schemas
 */
export declare function normalizeConfig(config: {
    schemas?: YamaSchemas | YamaEntities;
    entities?: YamaEntities | YamaSchemas;
    [key: string]: any;
}): NormalizedYamaConfig;
/**
 * Get schemas from config (supports both 'schemas' and 'entities')
 */
export declare function getSchemasFromConfig(config: {
    schemas?: YamaSchemas | YamaEntities;
    entities?: YamaEntities | YamaSchemas;
    [key: string]: any;
}): UnifiedSchemas;
//# sourceMappingURL=config-normalizer.d.ts.map