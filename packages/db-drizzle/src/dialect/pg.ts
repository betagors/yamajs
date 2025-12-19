import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DatabaseDialect } from "./types.js";
import { sql } from "drizzle-orm";

export class PostgresDialect implements DatabaseDialect {
    private client: postgres.Sql | null = null;
    private db: ReturnType<typeof drizzle> | null = null;

    async connect(config: { url: string; pool?: { min?: number; max?: number } }): Promise<void> {
        if (!config.url) {
            throw new Error("PostgreSQL connection URL is required");
        }

        this.client = postgres(config.url, {
            max: config.pool?.max || 10,
            idle_timeout: 20,
            connect_timeout: 10,
        });

        this.db = drizzle(this.client);
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.end();
            this.client = null;
            this.db = null;
        }
    }

    getDrizzle(): any {
        if (!this.db) {
            throw new Error("PostgreSQL dialect not connected");
        }
        return this.db;
    }

    getRawSQL(query: string, params?: unknown[]): any {
        return sql.raw(query, params);
    }

    async ping(): Promise<boolean> {
        try {
            if (!this.client) return false;
            await this.client`SELECT 1`;
            return true;
        } catch {
            return false;
        }
    }
}
