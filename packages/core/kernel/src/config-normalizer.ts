import type { YamaEntities } from './entities.js';
import type { YamaSchemas } from './schemas.js';
import type { YamaOperations } from './operations/types.js';

/**
 * Normalized config with separate entities and schemas
 */
export interface NormalizedYamaConfig {
  /** Entity definitions (database models) */
  entities: YamaEntities;

  /** Schema definitions (DTOs, API types) */
  schemas: YamaSchemas;

  /** Operation definitions (API endpoints) */
  operations: YamaOperations;
}

/**
 * Normalize YAMA config to support separate 'entities', 'schemas' and 'operations' keys
 * 
 * @param config Raw config object
 * @returns Normalized config with separate entities, schemas and operations
 */
export function normalizeConfig(config: {
  entities?: YamaEntities;
  schemas?: YamaSchemas;
  operations?: YamaOperations;
  [key: string]: any;
}): NormalizedYamaConfig {
  return {
    entities: (config.entities || {}) as YamaEntities,
    schemas: (config.schemas || {}) as YamaSchemas,
    operations: (config.operations || {}) as YamaOperations,
  };
}

/**
 * Get entities from config
 */
export function getEntitiesFromConfig(config: {
  entities?: YamaEntities;
  [key: string]: any;
}): YamaEntities {
  return normalizeConfig(config).entities;
}

/**
 * Get schemas from config
 */
export function getSchemasFromConfig(config: {
  schemas?: YamaSchemas;
  [key: string]: any;
}): YamaSchemas {
  return normalizeConfig(config).schemas;
}

/**
 * Get operations from config
 */
export function getOperationsFromConfig(config: {
  operations?: YamaOperations;
  [key: string]: any;
}): YamaOperations {
  return normalizeConfig(config).operations;
}

