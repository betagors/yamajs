/**
 * Yama Database Intermediate Representation (IR)
 * 
 * This is the deterministic, versioned representation of the database schema.
 * It is used by database adapters to generate dialect-specific schemas (e.g., Drizzle tables).
 */

export interface DatabaseIR {
    tables: TableIR[];
}

export interface TableIR {
    /** The database table name (usually snake_case) */
    name: string;
    /** The original entity name (PascalCase) */
    entityName: string;
    columns: ColumnIR[];
    indexes: IndexIR[];
}

export type DBColumnType =
    | "uuid"
    | "varchar"
    | "text"
    | "integer"
    | "bigint"
    | "decimal"
    | "boolean"
    | "timestamp"
    | "timestamptz"
    | "date"
    | "time"
    | "jsonb";

export interface ColumnIR {
    /** The database column name (usually snake_case) */
    name: string;
    /** The original field name (camelCase) */
    fieldName: string;
    type: DBColumnType;
    /** SQL type override if literal type is needed */
    dbType?: string;
    primary?: boolean;
    unique?: boolean;
    nullable?: boolean;
    default?: unknown;
    generated?: boolean;
    length?: number;
    precision?: number;
    scale?: number;
    /** Foreign key reference */
    references?: {
        table: string;
        column: string;
        onDelete?: "cascade" | "setNull" | "restrict" | "noAction";
        onUpdate?: "cascade" | "setNull" | "restrict" | "noAction";
    };
}

export interface IndexIR {
    name?: string;
    columns: string[];
    unique?: boolean;
}
