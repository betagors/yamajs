import { drizzle } from "drizzle-orm/pglite";
import type { DatabaseDialect } from "./types.js";
import { sql } from "drizzle-orm";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export class PGliteDialect implements DatabaseDialect {
    private client: any | null = null;
    private db: ReturnType<typeof drizzle> | null = null;

    async connect(config: { path?: string; memory?: boolean }): Promise<void> {
        const { PGlite } = await import("@electric-sql/pglite");

        let options: { dataDir?: string } = {};

        if (config.memory) {
            // In-memory
        } else if (config.path) {
            options.dataDir = config.path;
        } else {
            // Default path
            const defaultPath = join(process.cwd(), ".yama", "data", "db", "pglite");
            // Ensure directory exists
            try {
                const dbDir = join(process.cwd(), ".yama", "data", "db");
                if (!existsSync(dbDir)) {
                    mkdirSync(dbDir, { recursive: true });
                }
            } catch (e) {
                console.error("Failed to create pglite directory", e);
            }
            options.dataDir = defaultPath;
        }

        try {
            this.client = new PGlite(options);
            await this.client.waitReady;
            this.db = drizzle(this.client);
        } catch (err) {
            throw new Error(`Failed to initialize PGlite: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            // PGlite doesn't strictly require close, but good practice if available
            if (typeof this.client.close === "function") {
                await this.client.close();
            }
            this.client = null;
            this.db = null;
        }
    }

    getDrizzle(): any {
        if (!this.db) {
            throw new Error("PGlite dialect not connected");
        }
        return this.db;
    }

    getRawSQL(query: string, params?: unknown[]): any {
        return sql.raw(query, params);
    }

    async ping(): Promise<boolean> {
        try {
            if (!this.client) return false;
            await this.client.query("SELECT 1");
            return true;
        } catch {
            return false;
        }
    }
}
