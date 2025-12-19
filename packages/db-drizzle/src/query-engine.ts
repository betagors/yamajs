import type { DatabaseAPI, ExecuteResult } from "@yamajs/kernel";
import type { DatabaseDialect } from "./dialect/types.js";
import type { SQLTemplateTag } from "@yamajs/kernel";

/**
 * Drizzle-based implementation of Yama Database API
 */
export class DrizzleQueryEngine implements DatabaseAPI {
    constructor(
        private drizzle: any, // Drizzle instance
        private schema: Record<string, any>, // Drizzle table definitions
        public readonly $sql: SQLTemplateTag,
        private dialect: DatabaseDialect
    ) {
        // Proxy table access to Drizzle
        return new Proxy(this, {
            get(target, prop, receiver) {
                if (typeof prop === "string" && !prop.startsWith("$") && target.schema[prop]) {
                    return target.createTableAPI(prop);
                }
                return Reflect.get(target, prop, receiver);
            },
        });
    }

    async $raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        const rawSql = this.dialect.getRawSQL(sql, params);
        const result = await this.drizzle.execute(rawSql);
        // Standardize output - Drizzle returns different things for different drivers sometimes
        // But usually .execute() returns the raw result. 
        // .execute() on drizzle object usually returns the driver response.
        // However, we want just the rows.
        // For now, assume rows are directly iterable or available.
        return (Array.isArray(result) ? result : result.rows || result) as T[];
    }

    async $transaction<T>(fn: (tx: DatabaseAPI) => Promise<T>): Promise<T> {
        return this.drizzle.transaction(async (tx: any) => {
            const txEngine = new DrizzleQueryEngine(tx, this.schema, this.$sql, this.dialect);
            return fn(txEngine);
        });
    }

    [tableName: string]: any;

    private createTableAPI(tableName: string) {
        const table = this.schema[tableName];

        return {
            findMany: async (config?: any) => {
                // Drizzle relational query API: db.query.table.findMany(config)
                return this.drizzle.query[tableName].findMany(config);
            },
            findFirst: async (config?: any) => {
                return this.drizzle.query[tableName].findFirst(config);
            },
            insert: async (data: any | any[]) => {
                // Core API: db.insert(table).values(data).returning()
                const result = await this.drizzle.insert(table).values(data).returning();
                return Array.isArray(data) ? result : result[0];
            },
            update: async (where: any, data: any) => {
                // This needs translation from Yama 'where' to Drizzle 'where'
                // For now, simplicity: assume it's Drizzle-compatible or literal
                const query = this.drizzle.update(table).set(data);
                if (where) {
                    // Placeholder for where logic
                }
                return query.returning();
            },
            delete: async (where: any) => {
                const query = this.drizzle.delete(table);
                if (where) {
                    // Placeholder for where logic
                }
                return query.returning();
            },
            count: async (where: any) => {
                // Placeholder for count logic
                return 0;
            }
        };
    }
}
