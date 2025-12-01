import type { Model } from "./model.js";
/**
 * Result of comparing two models
 */
export interface DiffResult {
    added: {
        tables: string[];
        columns: Array<{
            table: string;
            column: string;
        }>;
        indexes: Array<{
            table: string;
            index: string;
        }>;
        foreignKeys: Array<{
            table: string;
            fk: string;
        }>;
    };
    removed: {
        tables: string[];
        columns: Array<{
            table: string;
            column: string;
        }>;
        indexes: Array<{
            table: string;
            index: string;
        }>;
        foreignKeys: Array<{
            table: string;
            fk: string;
        }>;
    };
    modified: {
        tables: Array<{
            table: string;
            changes: string[];
        }>;
        columns: Array<{
            table: string;
            column: string;
            changes: string[];
        }>;
    };
}
/**
 * Migration step types
 */
export type MigrationStepType = "add_table" | "drop_table" | "add_column" | "drop_column" | "modify_column" | "add_index" | "drop_index" | "add_foreign_key" | "drop_foreign_key";
/**
 * Base migration step
 */
export interface MigrationStep {
    type: MigrationStepType;
    table: string;
}
/**
 * Add table step
 */
export interface AddTableStep extends MigrationStep {
    type: "add_table";
    columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primary?: boolean;
        default?: unknown;
        generated?: boolean;
    }>;
}
/**
 * Drop table step
 */
export interface DropTableStep extends MigrationStep {
    type: "drop_table";
}
/**
 * Add column step
 */
export interface AddColumnStep extends MigrationStep {
    type: "add_column";
    column: {
        name: string;
        type: string;
        nullable: boolean;
        default?: unknown;
        generated?: boolean;
    };
}
/**
 * Drop column step
 */
export interface DropColumnStep extends MigrationStep {
    type: "drop_column";
    column: string;
}
/**
 * Modify column step
 */
export interface ModifyColumnStep extends MigrationStep {
    type: "modify_column";
    column: string;
    changes: {
        type?: string;
        nullable?: boolean;
        default?: unknown;
    };
}
/**
 * Add index step
 */
export interface AddIndexStep extends MigrationStep {
    type: "add_index";
    index: {
        name: string;
        columns: string[];
        unique: boolean;
    };
}
/**
 * Drop index step
 */
export interface DropIndexStep extends MigrationStep {
    type: "drop_index";
    index: string;
}
/**
 * Add foreign key step
 */
export interface AddForeignKeyStep extends MigrationStep {
    type: "add_foreign_key";
    foreignKey: {
        name: string;
        columns: string[];
        references: {
            table: string;
            columns: string[];
        };
    };
}
/**
 * Drop foreign key step
 */
export interface DropForeignKeyStep extends MigrationStep {
    type: "drop_foreign_key";
    foreignKey: string;
}
/**
 * Union of all migration step types
 */
export type MigrationStepUnion = AddTableStep | DropTableStep | AddColumnStep | DropColumnStep | ModifyColumnStep | AddIndexStep | DropIndexStep | AddForeignKeyStep | DropForeignKeyStep;
/**
 * Compare two models and compute the diff
 */
export declare function computeDiff(from: Model, to: Model): DiffResult;
/**
 * Convert diff result to migration steps
 */
export declare function diffToSteps(diff: DiffResult, from: Model, to: Model): MigrationStepUnion[];
