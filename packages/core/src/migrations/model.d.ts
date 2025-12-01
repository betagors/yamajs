import type { YamaEntities } from "../entities.js";
/**
 * Represents the schema state of the database
 */
export interface Model {
    hash: string;
    entities: YamaEntities;
    tables: Map<string, TableModel>;
}
/**
 * Represents a table in the model
 */
export interface TableModel {
    name: string;
    columns: Map<string, ColumnModel>;
    indexes: IndexModel[];
    foreignKeys: ForeignKeyModel[];
}
/**
 * Represents a column in a table
 */
export interface ColumnModel {
    name: string;
    type: string;
    nullable: boolean;
    primary: boolean;
    default?: unknown;
    generated?: boolean;
}
/**
 * Represents an index
 */
export interface IndexModel {
    name: string;
    columns: string[];
    unique: boolean;
}
/**
 * Represents a foreign key
 */
export interface ForeignKeyModel {
    name: string;
    columns: string[];
    references: {
        table: string;
        columns: string[];
    };
}
/**
 * Compute SHA-256 hash of entities
 */
export declare function computeModelHash(entities: YamaEntities): string;
/**
 * Convert entities to Model representation
 */
export declare function entitiesToModel(entities: YamaEntities): Model;
/**
 * Compare two models and return the difference
 * This is a placeholder - actual diff logic will be in diff.ts
 */
export interface MigrationDiff {
    fromHash: string;
    toHash: string;
    hasChanges: boolean;
}
export declare function compareModels(from: Model, to: Model): MigrationDiff;
