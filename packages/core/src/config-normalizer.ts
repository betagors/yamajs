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
export function normalizeConfig(config: {
  schemas?: YamaSchemas | YamaEntities;
  entities?: YamaEntities | YamaSchemas;
  [key: string]: any;
}): NormalizedYamaConfig {
  // 'schemas' takes precedence
  if (config.schemas) {
    return {
      schemas: config.schemas as UnifiedSchemas,
      sourceKey: 'schemas',
    };
  }
  
  // Fall back to 'entities' if 'schemas' not present
  if (config.entities) {
    return {
      schemas: config.entities as UnifiedSchemas,
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
export function getSchemasFromConfig(config: {
  schemas?: YamaSchemas | YamaEntities;
  entities?: YamaEntities | YamaSchemas;
  [key: string]: any;
}): UnifiedSchemas {
  return normalizeConfig(config).schemas;
}

