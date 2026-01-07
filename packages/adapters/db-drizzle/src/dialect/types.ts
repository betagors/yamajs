import type { SQL } from "drizzle-orm";

export interface DatabaseDialect {
    /**
     * Connect to the database
     */
    connect(config: any): Promise<void>;

    /**
     * Disconnect from the database
     */
    disconnect(): Promise<void>;

    /**
     * Get the Drizzle instance
     */
    getDrizzle(): any;

    /**
     * Get the raw SQL template tag
     */
    getRawSQL(sql: string, params?: unknown[]): SQL;

    /**
     * Health check
     */
    ping(): Promise<boolean>;
}
