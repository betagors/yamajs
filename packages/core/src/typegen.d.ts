import type { SchemaField, YamaSchemas } from "./schemas.js";
import type { YamaEntities } from "./entities.js";
import type { YamaOperations } from "./operations/types.js";
/**
 * Endpoint definition for handler context generation
 */
export interface EndpointDefinition {
    path: string;
    method: string;
    handler?: string;
    description?: string;
    params?: Record<string, SchemaField>;
    query?: Record<string, SchemaField>;
    body?: {
        type?: string;
    };
    response?: {
        type?: string;
        properties?: Record<string, SchemaField>;
        required?: string[];
    };
    auth?: {
        required?: boolean;
        roles?: string[];
    };
}
/**
 * Yama config for handler context generation
 */
export interface HandlerContextConfig {
    schemas?: YamaSchemas;
    entities?: YamaEntities;
    apis?: {
        rest?: any;
    };
    operations?: YamaOperations;
    policies?: import("./policies/types.js").YamaPolicies;
}
/**
 * Available services configuration for handler context generation
 */
export interface AvailableServices {
    db?: boolean;
    entities?: boolean;
    cache?: boolean;
    storage?: boolean;
    realtime?: boolean;
}
/**
 * Generate TypeScript types from Yama schemas and entities
 */
export declare function generateTypes(schemas?: YamaSchemas, entities?: YamaEntities): string;
/**
 * Generate handler context types from Yama config
 */
export declare function generateHandlerContexts(config: HandlerContextConfig, typesImportPath?: string, handlerContextImportPath?: string, repositoryTypesImportPath?: string, availableServices?: AvailableServices): string;
//# sourceMappingURL=typegen.d.ts.map