import type {
    DatabaseAPI,
    ExecuteResult,
    DatabaseProviderConfig,
    ProviderContext,
    Provider,
    ProviderType,
    HealthCheckResult,
    SQLTemplateTag
} from "@yamajs/kernel";
import { generateDatabaseIR, generateDrizzleSchemaFromIR } from "@yamajs/kernel";
import type { DatabaseDialect } from "./dialect/types.js";
import { PostgresDialect } from "./dialect/pg.js";
import { PGliteDialect } from "./dialect/pglite.js";
import { DrizzleQueryEngine } from "./query-engine.js";

export class DrizzleDatabaseAdapter implements Provider<DatabaseProviderConfig, DatabaseAPI> {
    public readonly type: ProviderType = "database";
    public readonly version = "1.0.0";

    private dialect: DatabaseDialect | null = null;
    private engine: DrizzleQueryEngine | null = null;
    private _adapterName: string = "unknown";

    get adapter(): string {
        return this._adapterName;
    }

    async init(config: DatabaseProviderConfig, context: ProviderContext): Promise<DatabaseAPI> {
        this._adapterName = config.adapter;

        // Select Dialect
        if (config.adapter === "postgres") {
            this.dialect = new PostgresDialect();
            await this.dialect.connect({ url: config.url || process.env.DATABASE_URL || "", pool: config.pool });
        } else if (config.adapter === "pglite") {
            this.dialect = new PGliteDialect();
            await this.dialect.connect({ path: config.path, memory: config.memory });
        } else {
            throw new Error(`Unsupported database adapter: ${config.adapter}`);
        }

        // Generate Schema (Runtime dynamic generation?)
        // In a real app, we might load pre-compiled schema. 
        // But for now, we follow Yama's "schema flows" -> Entities -> IR -> Drizzle Schema
        // However, Drizzle needs actual TS schema objects to be useful for `db.query.User` style access
        // if we are doing fully dynamic runtime with valid types we probably need a way 
        // to map the string-generated schema back to a JS object Drizzle can use.
        // Drizzle's `pgTable` returns a table object.

        // CRITICAL: Drizzle expects a schema object { users: PgTable, ... } to use the query builder.
        // If we only generate text with `generateDrizzleSchemaFromIR`, we can't trivially use it 
        // at runtime without Eval or a build step.
        // BUT: The prompt says "This file is generated, never edited." in section 5.
        // This implies there IS a generation step that writes to disk.
        // The standard Yama flow is typically `yama generate`.
        // So `init` here should theoretically LOAD the generated schema.

        // For runtime usage without a build step (if Yama supports that), we'd need to construct 
        // Drizzle table objects dynamically in memory.
        // Given the constraints and the prompt's emphasis on codegen, we assume
        // we should try to load the generated schema if it exists, or maybe fall back?
        // Actually, section 10: "Define DB IR in core -> Generate Drizzle tables from IR -> Wrap Drizzle queries".

        // Let's assume for now we just pass an empty schema or try to dynamically construct it if possible.
        // Dynamic table construction is tricky with Drizzle's typed nature but possible for runtime.
        // We will use a mock schema for now or implement a dynamic schema builder in future.
        // For now, let's construct an empty schema to satisfy the engine.
        const schema = {};

        // Create SQL Tag
        const sqlTag: SQLTemplateTag = (strings: TemplateStringsArray, ...values: unknown[]) => {
            return {
                sql: strings.reduce((acc: string, str: string, i: number) => acc + str + (i < values.length ? `$${i + 1}` : ""), ""),
                params: values
            };
        };

        // Initialize Engine
        this.engine = new DrizzleQueryEngine(
            this.dialect.getDrizzle(),
            schema,
            sqlTag,
            this.dialect
        );

        return this.engine;
    }

    getAPI(): DatabaseAPI {
        if (!this.engine) {
            throw new Error("Database provider not initialized");
        }
        return this.engine;
    }

    isInitialized(): boolean {
        return !!this.engine;
    }

    async healthCheck(): Promise<HealthCheckResult> {
        if (!this.dialect) {
            return { healthy: false, error: "Not initialized" };
        }
        try {
            const isAlive = await this.dialect.ping();
            return { healthy: isAlive };
        } catch (e) {
            return { healthy: false, error: String(e) };
        }
    }

    async shutdown(): Promise<void> {
        if (this.dialect) {
            await this.dialect.disconnect();
        }
    }
}

/**
 * Factory for registering the adapter
 */
export function createDrizzleAdapter(): Provider<DatabaseProviderConfig, DatabaseAPI> {
    return new DrizzleDatabaseAdapter();
}
