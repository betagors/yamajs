import type { MigrationStepUnion } from "./diff.js";
export type { MigrationStepUnion } from "./diff.js";
/**
 * Migration YAML structure
 */
export interface MigrationYAML {
    type: "schema";
    from_model: {
        hash: string;
    };
    to_model: {
        hash: string;
    };
    steps: MigrationStepUnion[];
    metadata: {
        generated_at: string;
        generated_by: string;
        description?: string;
    };
}
/**
 * Serialize migration to YAML string
 */
export declare function serializeMigration(migration: MigrationYAML): string;
/**
 * Deserialize migration from YAML/JSON string
 * Supports both YAML and JSON formats for backward compatibility
 */
export declare function deserializeMigration(content: string): MigrationYAML;
/**
 * Create a new migration YAML
 */
export declare function createMigration(fromHash: string, toHash: string, steps: MigrationStepUnion[], description?: string): MigrationYAML;
