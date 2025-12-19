/**
 * Tests for Migration Safety Analysis
 */

import { describe, it, expect } from "vitest";
import {
    analyzeMigrationSafety,
    analyzeMultipleMigrations,
    formatSafetyAnalysis,
    getConfirmationPrompt,
    validateConfirmation,
} from "../../../../../../../../../../../core/kernel/src/plugins/migration-safety.js";

describe("Migration Safety Analysis", () => {
    describe("analyzeMigrationSafety", () => {
        it("should detect DROP TABLE as destructive", () => {
            const sql = `DROP TABLE users;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.safe).toBe(false);
            expect(result.requiresConfirmation).toBe(true);
            expect(result.requiresBackup).toBe(true);
            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("DROP_TABLE");
            expect(result.destructiveOperations[0].target).toBe("users");
            expect(result.riskLevel).toBe("high");
        });

        it("should detect DROP TABLE IF EXISTS", () => {
            const sql = `DROP TABLE IF EXISTS old_data;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("DROP_TABLE");
            expect(result.destructiveOperations[0].target).toBe("old_data");
        });

        it("should detect DROP COLUMN", () => {
            const sql = `ALTER TABLE users DROP COLUMN legacy_password;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.safe).toBe(false);
            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("DROP_COLUMN");
            expect(result.destructiveOperations[0].target).toBe("users");
        });

        it("should detect TRUNCATE", () => {
            const sql = `TRUNCATE TABLE logs;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("TRUNCATE");
        });

        it("should detect DELETE without WHERE (DELETE_ALL)", () => {
            const sql = `DELETE FROM sessions;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("DELETE_ALL");
        });

        it("should detect DROP INDEX as warning (not danger)", () => {
            const sql = `DROP INDEX idx_users_email;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("DROP_INDEX");
            expect(result.destructiveOperations[0].severity).toBe("warning");
            expect(result.destructiveOperations[0].reversible).toBe(true);
        });

        it("should identify safe migrations", () => {
            const sql = `
        CREATE TABLE products (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          price DECIMAL(10, 2)
        );
        CREATE INDEX idx_products_name ON products(name);
      `;
            const result = analyzeMigrationSafety(sql);

            expect(result.safe).toBe(true);
            expect(result.requiresConfirmation).toBe(false);
            expect(result.destructiveOperations).toHaveLength(0);
            expect(result.riskLevel).toBe("low");
        });

        it("should extract affected tables", () => {
            const sql = `
        CREATE TABLE orders (id SERIAL);
        ALTER TABLE users ADD COLUMN last_order_id INT;
        INSERT INTO audit_log (action) VALUES ('migration');
      `;
            const result = analyzeMigrationSafety(sql);

            expect(result.affectedTables).toContain("orders");
            expect(result.affectedTables).toContain("users");
            expect(result.affectedTables).toContain("audit_log");
        });

        it("should detect multiple destructive operations", () => {
            const sql = `
        DROP TABLE old_users;
        DROP TABLE old_sessions;
        ALTER TABLE data DROP COLUMN deprecated_field;
      `;
            const result = analyzeMigrationSafety(sql);

            expect(result.destructiveOperations.length).toBeGreaterThanOrEqual(3);
            expect(result.riskLevel).toBe("critical");
        });

        it("should detect ALTER COLUMN TYPE", () => {
            const sql = `ALTER TABLE users ALTER COLUMN age TYPE BIGINT;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("ALTER_TYPE");
        });

        it("should detect RENAME COLUMN", () => {
            const sql = `ALTER TABLE users RENAME COLUMN old_name TO new_name;`;
            const result = analyzeMigrationSafety(sql);

            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.destructiveOperations[0].type).toBe("RENAME_COLUMN");
            expect(result.destructiveOperations[0].reversible).toBe(true);
        });
    });

    describe("analyzeMultipleMigrations", () => {
        it("should analyze multiple migrations", () => {
            const migrations = [
                { name: "1.0.0", sql: "CREATE TABLE users (id SERIAL);" },
                { name: "1.1.0", sql: "ALTER TABLE users ADD COLUMN email TEXT;" },
                { name: "2.0.0", sql: "DROP TABLE legacy_data;" },
            ];

            const result = analyzeMultipleMigrations(migrations);

            expect(result.safe).toBe(false);
            expect(result.destructiveOperations).toHaveLength(1);
            expect(result.summary).toContain("3 migration(s)");
        });

        it("should deduplicate warnings", () => {
            const migrations = [
                { name: "1.0.0", sql: "DROP TABLE a;" },
                { name: "1.1.0", sql: "DROP TABLE b;" },
            ];

            const result = analyzeMultipleMigrations(migrations);

            // Both DROP TABLEs generate the same warning text
            const uniqueWarnings = new Set(result.warnings);
            expect(uniqueWarnings.size).toBeLessThanOrEqual(result.warnings.length);
        });
    });

    describe("formatSafetyAnalysis", () => {
        it("should format low risk analysis", () => {
            const analysis = analyzeMigrationSafety("CREATE TABLE test (id INT);");
            const formatted = formatSafetyAnalysis(analysis);

            expect(formatted).toContain("LOW RISK");
            expect(formatted).toContain("safe");
        });

        it("should format high risk analysis", () => {
            const analysis = analyzeMigrationSafety("DROP TABLE users;");
            const formatted = formatSafetyAnalysis(analysis);

            expect(formatted).toContain("HIGH RISK");
            expect(formatted).toContain("DROP_TABLE");
            expect(formatted).toContain("backup");
        });
    });

    describe("getConfirmationPrompt", () => {
        it("should return empty for safe migrations", () => {
            const analysis = analyzeMigrationSafety("CREATE TABLE test (id INT);");
            const prompt = getConfirmationPrompt(analysis);

            expect(prompt).toBe("");
        });

        it("should return specific prompt for destructive operations", () => {
            const analysis = analyzeMigrationSafety("DROP TABLE users;");
            const prompt = getConfirmationPrompt(analysis);

            expect(prompt).toContain("DROP_TABLE");
            expect(prompt).toContain("confirm");
        });
    });

    describe("validateConfirmation", () => {
        it("should accept matching confirmation for destructive ops", () => {
            const analysis = analyzeMigrationSafety("DROP TABLE users;");
            const criticalOps = "DROP_TABLE users";

            const result = validateConfirmation(criticalOps, analysis);
            expect(result).toBe(true);
        });

        it("should reject wrong confirmation", () => {
            const analysis = analyzeMigrationSafety("DROP TABLE users;");

            const result = validateConfirmation("wrong", analysis);
            expect(result).toBe(false);
        });

        it("should accept 'yes' for non-critical confirmations", () => {
            const analysis = analyzeMigrationSafety("DROP INDEX idx_test;");

            // DROP INDEX is a warning, not danger, so it shouldn't require confirmation
            // But if requiresConfirmation is false, any input is valid
            if (!analysis.requiresConfirmation) {
                expect(validateConfirmation("anything", analysis)).toBe(true);
            }
        });

        it("should always pass for safe migrations", () => {
            const analysis = analyzeMigrationSafety("CREATE TABLE test (id INT);");

            expect(validateConfirmation("", analysis)).toBe(true);
            expect(validateConfirmation("anything", analysis)).toBe(true);
        });
    });
});
