import type { EntityDefinition, YamaEntities } from "./entities.js";
import type { SchemaField } from "./schemas.js";
/**
 * Endpoint definition for CRUD operations
 */
export interface CrudEndpoint {
    path: string;
    method: string;
    description?: string;
    params?: Record<string, SchemaField>;
    query?: Record<string, SchemaField>;
    body?: {
        type: string;
    };
    response?: {
        type: string;
    };
    auth?: {
        required?: boolean;
        roles?: string[];
    };
}
/**
 * Generate CRUD endpoints for an entity
 */
export declare function generateCrudEndpoints(entityName: string, entityDef: EntityDefinition, entities: YamaEntities): CrudEndpoint[];
/**
 * Generate CRUD endpoints for all entities
 */
export declare function generateAllCrudEndpoints(entities: YamaEntities): CrudEndpoint[];
/**
 * Generate input schemas for CRUD operations (Create and Update)
 */
export declare function generateCrudInputSchemas(entityName: string, entityDef: EntityDefinition): Record<string, {
    fields: Record<string, SchemaField>;
}>;
/**
 * Generate array schema for list responses
 */
export declare function generateArraySchema(entityName: string, entityDef: EntityDefinition): Record<string, {
    fields: Record<string, SchemaField>;
}>;
