/**
 * Migration Lock System
 * 
 * Prevents concurrent migrations from multiple processes using PostgreSQL advisory locks.
 * This ensures only one migration can run at a time for a given plugin.
 */

/**
 * Lock status information
 */
export interface LockStatus {
    acquired: boolean;
    pluginName: string;
    lockId: number;
    acquiredAt?: Date;
}

/**
 * Migration lock options
 */
export interface MigrationLockOptions {
    /** Timeout in milliseconds to wait for lock acquisition */
    timeoutMs?: number;
    /** Retry interval in milliseconds */
    retryIntervalMs?: number;
    /** Whether to use session-level lock (released on disconnect) vs transaction-level */
    sessionLevel?: boolean;
}

const DEFAULT_OPTIONS: Required<MigrationLockOptions> = {
    timeoutMs: 30000,
    retryIntervalMs: 1000,
    sessionLevel: true,
};

/**
 * MigrationLock - Prevents concurrent plugin migrations
 * 
 * Uses PostgreSQL pg_advisory_lock for distributed locking.
 * Falls back to in-memory lock for non-PostgreSQL databases.
 */
export class MigrationLock {
    private db: any;
    private pluginName: string;
    private lockId: number;
    private options: Required<MigrationLockOptions>;
    private acquired: boolean = false;
    private acquiredAt?: Date;

    // In-memory fallback for non-PostgreSQL databases
    private static inMemoryLocks = new Map<number, string>();

    constructor(db: any, pluginName: string, options: MigrationLockOptions = {}) {
        this.db = db;
        this.pluginName = pluginName;
        this.lockId = this.hashPluginName(pluginName);
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Acquire the migration lock
     * 
     * @returns true if lock was acquired
     * @throws Error if lock could not be acquired within timeout
     */
    async acquire(): Promise<boolean> {
        if (this.acquired) {
            return true; // Already acquired by this instance
        }

        const startTime = Date.now();

        while (Date.now() - startTime < this.options.timeoutMs) {
            try {
                const lockAcquired = await this.tryAcquire();
                if (lockAcquired) {
                    this.acquired = true;
                    this.acquiredAt = new Date();
                    return true;
                }
            } catch (error) {
                // Lock might be held by another process, retry
                const elapsed = Date.now() - startTime;
                const remaining = this.options.timeoutMs - elapsed;

                if (remaining <= 0) {
                    break;
                }
            }

            await this.sleep(this.options.retryIntervalMs);
        }

        throw new Error(
            `Could not acquire migration lock for ${this.pluginName} within ${this.options.timeoutMs}ms. ` +
            `Another migration might be running. Lock ID: ${this.lockId}`
        );
    }

    /**
     * Try to acquire the lock (single attempt)
     */
    private async tryAcquire(): Promise<boolean> {
        // Check if database supports advisory locks (PostgreSQL)
        if (await this.supportsAdvisoryLocks()) {
            return this.acquirePostgresLock();
        }

        // Fallback to in-memory lock
        return this.acquireInMemoryLock();
    }

    /**
     * Check if the database supports advisory locks
     */
    private async supportsAdvisoryLocks(): Promise<boolean> {
        try {
            // Try a simple query to check if pg_try_advisory_lock exists
            await this.db.unsafe(`SELECT pg_try_advisory_lock(0) WHERE false`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Acquire PostgreSQL advisory lock
     */
    private async acquirePostgresLock(): Promise<boolean> {
        const lockFunction = this.options.sessionLevel
            ? 'pg_try_advisory_lock'
            : 'pg_try_advisory_xact_lock';

        const result = await this.db.unsafe(
            `SELECT ${lockFunction}($1) as acquired`,
            [this.lockId]
        );

        return result?.[0]?.acquired === true;
    }

    /**
     * Acquire in-memory lock (fallback for non-PostgreSQL)
     */
    private acquireInMemoryLock(): boolean {
        if (MigrationLock.inMemoryLocks.has(this.lockId)) {
            const holder = MigrationLock.inMemoryLocks.get(this.lockId);
            if (holder !== this.pluginName) {
                return false;
            }
        }

        MigrationLock.inMemoryLocks.set(this.lockId, this.pluginName);
        return true;
    }

    /**
     * Release the migration lock
     */
    async release(): Promise<void> {
        if (!this.acquired) {
            return; // Nothing to release
        }

        try {
            if (await this.supportsAdvisoryLocks()) {
                await this.releasePostgresLock();
            } else {
                this.releaseInMemoryLock();
            }
        } finally {
            this.acquired = false;
            this.acquiredAt = undefined;
        }
    }

    /**
     * Release PostgreSQL advisory lock
     */
    private async releasePostgresLock(): Promise<void> {
        if (this.options.sessionLevel) {
            await this.db.unsafe(
                `SELECT pg_advisory_unlock($1)`,
                [this.lockId]
            );
        }
        // Transaction-level locks are automatically released on commit/rollback
    }

    /**
     * Release in-memory lock
     */
    private releaseInMemoryLock(): void {
        MigrationLock.inMemoryLocks.delete(this.lockId);
    }

    /**
     * Get current lock status
     */
    getStatus(): LockStatus {
        return {
            acquired: this.acquired,
            pluginName: this.pluginName,
            lockId: this.lockId,
            acquiredAt: this.acquiredAt,
        };
    }

    /**
     * Check if lock is currently held (by any process)
     */
    async isLocked(): Promise<boolean> {
        if (await this.supportsAdvisoryLocks()) {
            // Try to acquire without blocking
            const result = await this.db.unsafe(
                `SELECT pg_try_advisory_lock($1) as acquired`,
                [this.lockId]
            );

            if (result?.[0]?.acquired === true) {
                // We got the lock, release it immediately
                await this.db.unsafe(`SELECT pg_advisory_unlock($1)`, [this.lockId]);
                return false;
            }
            return true;
        }

        return MigrationLock.inMemoryLocks.has(this.lockId);
    }

    /**
     * Hash plugin name to integer for pg_advisory_lock
     * Uses a simple but effective hash algorithm
     */
    private hashPluginName(name: string): number {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            const char = name.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Ensure positive number within PostgreSQL's bigint range
        return Math.abs(hash) % 2147483647;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Execute a function with migration lock
 * 
 * @example
 * ```ts
 * await withMigrationLock(db, '@yamajs/plugin-stripe', async () => {
 *   await runMigrations();
 * });
 * ```
 */
export async function withMigrationLock<T>(
    db: any,
    pluginName: string,
    fn: () => Promise<T>,
    options?: MigrationLockOptions
): Promise<T> {
    const lock = new MigrationLock(db, pluginName, options);

    await lock.acquire();

    try {
        return await fn();
    } finally {
        await lock.release();
    }
}

/**
 * Global migration lock for all plugins
 * Used when running migrations for multiple plugins at once
 */
export const GLOBAL_MIGRATION_LOCK_ID = 'yama:migrations:global';

/**
 * Create a global migration lock
 */
export function createGlobalMigrationLock(
    db: any,
    options?: MigrationLockOptions
): MigrationLock {
    return new MigrationLock(db, GLOBAL_MIGRATION_LOCK_ID, options);
}
