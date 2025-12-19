/**
 * Tests for Migration Lock System
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    MigrationLock,
    withMigrationLock,
    createGlobalMigrationLock,
    GLOBAL_MIGRATION_LOCK_ID,
} from "../../../../../../../../core/kernel/src/plugins/migration-lock.js";

describe("Migration Lock", () => {
    // Mock database for testing
    const createMockDb = (supportsAdvisory = false, lockAcquired = true) => ({
        unsafe: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes("pg_try_advisory_lock(0)")) {
                if (supportsAdvisory) {
                    return [];
                }
                throw new Error("function pg_try_advisory_lock does not exist");
            }
            if (sql.includes("pg_try_advisory_lock")) {
                return [{ acquired: lockAcquired }];
            }
            if (sql.includes("pg_advisory_unlock")) {
                return [{ unlocked: true }];
            }
            return [];
        }),
    });

    describe("MigrationLock", () => {
        it("should create lock with correct lock ID", () => {
            const db = createMockDb();
            const lock = new MigrationLock(db, "@yamajs/plugin-stripe");
            const status = lock.getStatus();

            expect(status.pluginName).toBe("@yamajs/plugin-stripe");
            expect(status.lockId).toBeGreaterThan(0);
            expect(status.acquired).toBe(false);
        });

        it("should generate consistent lock IDs for same plugin", () => {
            const db = createMockDb();
            const lock1 = new MigrationLock(db, "test-plugin");
            const lock2 = new MigrationLock(db, "test-plugin");

            expect(lock1.getStatus().lockId).toBe(lock2.getStatus().lockId);
        });

        it("should generate different lock IDs for different plugins", () => {
            const db = createMockDb();
            const lock1 = new MigrationLock(db, "plugin-a");
            const lock2 = new MigrationLock(db, "plugin-b");

            expect(lock1.getStatus().lockId).not.toBe(lock2.getStatus().lockId);
        });

        it("should use in-memory lock when PostgreSQL advisory locks not available", async () => {
            const db = createMockDb(false); // No advisory lock support
            const lock = new MigrationLock(db, "test-plugin");

            const acquired = await lock.acquire();

            expect(acquired).toBe(true);
            expect(lock.getStatus().acquired).toBe(true);

            await lock.release();
            expect(lock.getStatus().acquired).toBe(false);
        });

        it("should acquire PostgreSQL advisory lock when available", async () => {
            const db = createMockDb(true, true); // Advisory lock supported and acquired
            const lock = new MigrationLock(db, "test-plugin");

            const acquired = await lock.acquire();

            expect(acquired).toBe(true);
            expect(db.unsafe).toHaveBeenCalled();
        });

        it("should return true if already acquired", async () => {
            const db = createMockDb(false);
            const lock = new MigrationLock(db, "test-plugin");

            await lock.acquire();
            const secondAcquire = await lock.acquire();

            expect(secondAcquire).toBe(true);
        });

        it("should release lock properly", async () => {
            const db = createMockDb(false);
            const lock = new MigrationLock(db, "test-plugin");

            await lock.acquire();
            expect(lock.getStatus().acquired).toBe(true);

            await lock.release();
            expect(lock.getStatus().acquired).toBe(false);
        });

        it("should have acquiredAt timestamp after acquiring", async () => {
            const db = createMockDb(false);
            const lock = new MigrationLock(db, "test-plugin");

            const before = new Date();
            await lock.acquire();
            const after = new Date();

            const status = lock.getStatus();
            expect(status.acquiredAt).toBeTruthy();
            expect(status.acquiredAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(status.acquiredAt!.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it("should timeout if lock cannot be acquired", async () => {
            // Create a mock that always fails to acquire
            const db = {
                unsafe: vi.fn().mockImplementation(async (sql: string) => {
                    if (sql.includes("pg_try_advisory_lock(0)")) {
                        throw new Error("not supported");
                    }
                    return [];
                }),
            };

            // First acquire a lock in-memory
            const lock1 = new MigrationLock(db, "test-plugin");
            await lock1.acquire();

            // Try to acquire same lock with short timeout
            const lock2 = new MigrationLock(db, "test-plugin", { timeoutMs: 100, retryIntervalMs: 50 });

            await expect(lock2.acquire()).rejects.toThrow("Could not acquire migration lock");
        });
    });

    describe("withMigrationLock", () => {
        it("should execute function with lock", async () => {
            const db = createMockDb(false);
            let executed = false;

            await withMigrationLock(db, "test-plugin", async () => {
                executed = true;
                return "result";
            });

            expect(executed).toBe(true);
        });

        it("should return function result", async () => {
            const db = createMockDb(false);

            const result = await withMigrationLock(db, "test-plugin", async () => {
                return { value: 42 };
            });

            expect(result).toEqual({ value: 42 });
        });

        it("should release lock after function completes", async () => {
            const db = createMockDb(false);

            await withMigrationLock(db, "test-plugin", async () => {
                return "done";
            });

            // Should be able to acquire same lock again
            const lock = new MigrationLock(db, "test-plugin");
            const acquired = await lock.acquire();
            expect(acquired).toBe(true);
        });

        it("should release lock even if function throws", async () => {
            const db = createMockDb(false);

            await expect(
                withMigrationLock(db, "test-plugin", async () => {
                    throw new Error("Function error");
                })
            ).rejects.toThrow("Function error");

            // Should be able to acquire same lock again
            const lock = new MigrationLock(db, "test-plugin");
            const acquired = await lock.acquire();
            expect(acquired).toBe(true);
        });
    });

    describe("createGlobalMigrationLock", () => {
        it("should create lock with global ID", () => {
            const db = createMockDb(false);
            const lock = createGlobalMigrationLock(db);

            expect(lock.getStatus().pluginName).toBe(GLOBAL_MIGRATION_LOCK_ID);
        });

        it("should prevent concurrent global locks", async () => {
            const db = createMockDb(false);

            const lock1 = createGlobalMigrationLock(db);
            await lock1.acquire();

            const lock2 = createGlobalMigrationLock(db, { timeoutMs: 100 });

            await expect(lock2.acquire()).rejects.toThrow();

            await lock1.release();
        });
    });
});
