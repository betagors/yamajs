/**
 * Database Provider - PGLite Adapter
 * 
 * Provides SQL database functionality using PGLite (Postgres in WASM).
 * Zero external dependencies in the adapter itself - PGLite is dynamically imported.
 * 
 * Features:
 * - Persistent or in-memory mode
 * - SQL query execution
 * - Transaction support
 * - SQL template tag for safe queries
 */

import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type {
    Provider,
    ProviderContext,
    DatabaseProviderConfig,
    DatabaseAPI,
    ExecuteResult,
    TransactionAPI,
    SQLTemplateTag,
} from '../../types.js';
import { registerAdapter } from '../../registry.js';

// ============================================================================
// SQL Template Tag
// ============================================================================

/**
 * SQL template tag for safe parameterized queries
 * 
 * @example
 * const { sql, params } = sqlTag`SELECT * FROM users WHERE id = ${userId}`;
 * // sql: 'SELECT * FROM users WHERE id = $1'
 * // params: [userId]
 */
function createSQLTemplateTag(): SQLTemplateTag {
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
        let sql = '';
        const params: unknown[] = [];

        for (let i = 0; i < strings.length; i++) {
            sql += strings[i];
            if (i < values.length) {
                params.push(values[i]);
                sql += `$${params.length}`;
            }
        }

        return { sql, params };
    };
}

// ============================================================================
// PGLite Database API Implementation
// ============================================================================

type PGliteClient = {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; fields: unknown[] }>;
    exec(sql: string): Promise<unknown>;
    close(): Promise<void>;
    waitReady?: Promise<void>;
};

class PGLiteDatabaseAPI implements DatabaseAPI {
    private client: PGliteClient;
    private debug: boolean;
    private logger: { debug: (msg: string, meta?: Record<string, unknown>) => void };

    readonly sql: SQLTemplateTag;

    constructor(
        client: PGliteClient,
        debug: boolean,
        logger: { debug: (msg: string, meta?: Record<string, unknown>) => void }
    ) {
        this.client = client;
        this.debug = debug;
        this.logger = logger;
        this.sql = createSQLTemplateTag();
    }

    async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        if (this.debug) {
            this.logger.debug('SQL Query', { sql, params });
        }

        const result = await this.client.query(sql, params);
        return result.rows as T[];
    }

    async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
        const rows = await this.query<T>(sql, params);
        return rows[0] ?? null;
    }

    async execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
        if (this.debug) {
            this.logger.debug('SQL Execute', { sql, params });
        }

        const result = await this.client.query(sql, params);

        // PGLite returns different structures for different query types
        // For INSERT/UPDATE/DELETE, we try to extract affected row count
        const rowsAffected = Array.isArray(result.rows) ? result.rows.length : 0;

        return {
            rowsAffected,
            // lastInsertId is not directly available in PGLite
            // Users should use RETURNING clause instead
        };
    }

    async transaction<T>(fn: (tx: TransactionAPI) => Promise<T>): Promise<T> {
        // Start transaction
        await this.client.query('BEGIN');

        try {
            // Create transaction API (same methods, but within transaction context)
            const txApi: TransactionAPI = {
                query: this.query.bind(this),
                queryOne: this.queryOne.bind(this),
                execute: this.execute.bind(this),
            };

            const result = await fn(txApi);

            // Commit transaction
            await this.client.query('COMMIT');

            return result;
        } catch (error) {
            // Rollback on error
            await this.client.query('ROLLBACK');
            throw error;
        }
    }

    getClient(): unknown {
        return this.client;
    }
}

// ============================================================================
// PGLite Database Provider
// ============================================================================

class PGLiteDatabaseProvider implements Provider<DatabaseProviderConfig, DatabaseAPI> {
    readonly type = 'database' as const;
    readonly adapter = 'pglite';
    readonly version = '1.0.0';

    private api: PGLiteDatabaseAPI | null = null;
    private client: PGliteClient | null = null;

    async init(config: DatabaseProviderConfig, context: ProviderContext): Promise<DatabaseAPI> {
        const debug = config.debug ?? false;

        // Dynamically import PGLite
        let PGlite: new (options?: { dataDir?: string }) => PGliteClient;
        try {
            const pgliteModule = await import('@electric-sql/pglite');
            PGlite = pgliteModule.PGlite;
        } catch (error) {
            throw new Error(
                `Failed to import @electric-sql/pglite. Make sure it's installed:\n` +
                `  npm install @electric-sql/pglite\n\n` +
                `Error: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        // Determine storage mode
        const options: { dataDir?: string } = {};
        let mode = 'persistent';

        if (config.memory) {
            // In-memory mode (no dataDir = in-memory)
            mode = 'in-memory';
        } else if (config.path) {
            // Custom path provided
            options.dataDir = config.path;
            mode = `custom: ${config.path}`;
        } else {
            // Default: persistent storage at .yama/data/db/pglite
            const dbDir = join(context.projectDir, '.yama', 'data', 'db', 'pglite');

            // Create directory if it doesn't exist
            if (!existsSync(dbDir)) {
                mkdirSync(dbDir, { recursive: true });
            }

            options.dataDir = dbDir;
            mode = `default: ${dbDir}`;
        }

        context.log.debug('Initializing PGLite', { mode, options });

        // Create PGLite instance
        try {
            this.client = new PGlite(options) as PGliteClient;

            // Wait for PGLite to be ready
            if (this.client.waitReady) {
                await this.client.waitReady;
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            if (errorMsg.includes('Aborted') || errorMsg.includes('abort')) {
                throw new Error(
                    `PGLite WASM initialization failed.\n` +
                    `This usually indicates:\n` +
                    `  1. Node.js version incompatibility (try Node.js 18+)\n` +
                    `  2. Missing WASM support in your environment\n` +
                    `  3. Memory/resource constraints\n\n` +
                    `Node.js version: ${process.version}\n` +
                    `Platform: ${process.platform} ${process.arch}\n\n` +
                    `Original error: ${errorMsg}`
                );
            }

            throw error;
        }

        // Create API
        this.api = new PGLiteDatabaseAPI(this.client, debug, context.log);

        context.log.info('PGLite database initialized', { mode });

        return this.api;
    }

    getAPI(): DatabaseAPI {
        if (!this.api) {
            throw new Error('Database provider not initialized. Call init() first.');
        }
        return this.api;
    }

    isInitialized(): boolean {
        return this.api !== null;
    }

    async healthCheck() {
        if (!this.client) {
            return { healthy: false, error: 'Not initialized' };
        }

        try {
            const start = Date.now();
            await this.client.query('SELECT 1');
            const latency = Date.now() - start;

            return {
                healthy: true,
                latency,
                details: {
                    adapter: 'pglite',
                },
            };
        } catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async shutdown(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.api = null;
        }
    }
}

// ============================================================================
// Register Adapter
// ============================================================================

registerAdapter('database', 'pglite', () => new PGLiteDatabaseProvider());

// ============================================================================
// Exports
// ============================================================================

export { PGLiteDatabaseProvider, PGLiteDatabaseAPI };
export { createSQLTemplateTag };
