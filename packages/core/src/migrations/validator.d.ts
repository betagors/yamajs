import type { MigrationYAML } from "./migration-yaml.js";
import type { MigrationStepUnion } from "./diff.js";
import type { Model } from "./model.js";
/**
 * Validation error
 */
export interface ValidationError {
    step?: number;
    message: string;
    field?: string;
}
/**
 * Validate migration YAML structure
 */
export declare function validateMigrationYAML(migration: MigrationYAML): ValidationError[];
/**
 * Validate that migration's from_model hash matches current model hash
 */
export declare function validateMigrationHash(migration: MigrationYAML, currentModel: Model): ValidationError[];
/**
 * Validate step dependencies
 */
export declare function validateStepDependencies(steps: MigrationStepUnion[], currentModel: Model): ValidationError[];
/**
 * Validate entire migration
 */
export declare function validateMigration(migration: MigrationYAML, currentModel: Model): ValidationError[];
