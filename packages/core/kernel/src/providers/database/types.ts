/**
 * Database Provider Contract
 */

import { SQLTemplateTag } from "./sql.js";

export interface DatabaseProviderConfig {
    adapter: 'pglite' | 'postgres';
    /** PGLite: storage directory path */
    path?: string;
    /** PGLite: use in-memory mode */
    memory?: boolean;
    /** Postgres: connection URL */
    url?: string;
    /** Connection pool settings */
    pool?: {
        min?: number;
        max?: number;
    };
    /** Enable SQL debugging */
    debug?: boolean;
}

export interface ExecuteResult {
    rowsAffected: number;
    lastInsertId?: string;
}

/**
 * Table-specific API for data access
 */
export interface TableAPI<TSelect = any, TInsert = any> {
    findMany(config?: any): Promise<TSelect[]>;
    findFirst(config?: any): Promise<TSelect | null>;
    insert(data: TInsert | TInsert[]): Promise<TSelect | TSelect[]>;
    update(where: any, data: Partial<TInsert>): Promise<TSelect[]>;
    delete(where: any): Promise<TSelect[]>;
    count(where?: any): Promise<number>;
}

export interface DatabaseAPI {
    /** Execute a raw SQL query and return rows */
    $raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;

    /** Start a transaction */
    $transaction<T>(fn: (tx: DatabaseAPI) => Promise<T>): Promise<T>;

    /** SQL template tag for safe queries */
    readonly $sql: SQLTemplateTag;

    /** Dynamic table access (e.g. ctx.db.user.findMany) */
    [tableName: string]: any;
}

/**
 * Type alias for backward compatibility or internal use
 */
export type TransactionAPI = DatabaseAPI;
