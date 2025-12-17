/**
 * Table Sandbox - Plugin Table Access Policy Engine
 *
 * Enforces table access restrictions for plugins to prevent
 * unauthorized database access and ensure isolation.
 */

/**
 * Table access policy for plugins
 */
export interface PluginTablePolicy {
    /** Plugin name this policy applies to */
    pluginName: string;

    /** Allowed table prefixes (e.g., ["stripe_", "payment_"]) */
    allowedPrefixes: string[];

    /** Explicitly allowed tables (e.g., ["users"]) */
    allowedTables: string[];

    /** Tables shared across multiple plugins */
    sharedTables: string[];

    /** Policy mode: strict = deny by default, permissive = allow by default */
    mode: "strict" | "permissive";
}

/**
 * SQL operation types
 */
export type SQLOperation =
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CREATE"
    | "ALTER"
    | "DROP"
    | "TRUNCATE"
    | "GRANT"
    | "REVOKE";

/**
 * Sandbox violation information
 */
export interface SandboxViolation {
    /** Table that was accessed */
    table: string;

    /** Operation attempted */
    operation: SQLOperation;

    /** Reason for violation */
    reason: string;

    /** Severity level */
    severity: "error" | "warning";
}

/**
 * Sandbox validation result
 */
export interface SandboxValidationResult {
    /** Whether the SQL passes the policy */
    valid: boolean;

    /** List of violations found */
    violations: SandboxViolation[];

    /** All tables accessed in the SQL */
    tablesAccessed: string[];

    /** Operations found in the SQL */
    operationsFound: SQLOperation[];
}

/**
 * Table access info extracted from SQL
 */
export interface TableAccess {
    table: string;
    operation: SQLOperation;
    statement: string;
}

/**
 * Default shared tables that all plugins can access
 */
export const DEFAULT_SHARED_TABLES: string[] = [
    // Yama internal tables
    "_yama_plugin_migrations",
    "_yama_plugin_versions",
    "_yama_audit_log",
    "_yama_migrations",
];

/**
 * Default policy for plugins without explicit configuration
 */
export const DEFAULT_POLICY_MODE: "strict" | "permissive" = "strict";

/**
 * SQL patterns for extracting table names
 */
const SQL_PATTERNS = {
    // CREATE TABLE table_name
    CREATE_TABLE: /CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:ONLY\s+)?["'`]?(\w+)["'`]?/gi,

    // DROP TABLE table_name
    DROP_TABLE: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["'`]?(\w+)["'`]?/gi,

    // ALTER TABLE table_name
    ALTER_TABLE: /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?["'`]?(\w+)["'`]?/gi,

    // TRUNCATE table_name
    TRUNCATE: /TRUNCATE\s+(?:TABLE\s+)?(?:ONLY\s+)?["'`]?(\w+)["'`]?/gi,

    // INSERT INTO table_name
    INSERT: /INSERT\s+INTO\s+["'`]?(\w+)["'`]?/gi,

    // UPDATE table_name
    UPDATE: /UPDATE\s+(?:ONLY\s+)?["'`]?(\w+)["'`]?\s+SET/gi,

    // DELETE FROM table_name
    DELETE: /DELETE\s+FROM\s+(?:ONLY\s+)?["'`]?(\w+)["'`]?/gi,

    // SELECT ... FROM table_name
    SELECT_FROM: /FROM\s+["'`]?(\w+)["'`]?(?:\s+(?:AS\s+)?\w+)?(?:\s*,\s*["'`]?(\w+)["'`]?(?:\s+(?:AS\s+)?\w+)?)*/gi,

    // JOIN table_name
    JOIN: /(?:LEFT\s+|RIGHT\s+|INNER\s+|OUTER\s+|CROSS\s+|FULL\s+)?JOIN\s+["'`]?(\w+)["'`]?/gi,

    // CREATE INDEX ... ON table_name
    CREATE_INDEX: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?["'`]?\w+["'`]?\s+ON\s+["'`]?(\w+)["'`]?/gi,

    // DROP INDEX
    DROP_INDEX: /DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?["'`]?(\w+)["'`]?/gi,

    // GRANT ... ON table_name
    GRANT: /GRANT\s+\w+(?:\s*,\s*\w+)*\s+ON\s+(?:TABLE\s+)?["'`]?(\w+)["'`]?/gi,

    // REVOKE ... ON table_name
    REVOKE: /REVOKE\s+\w+(?:\s*,\s*\w+)*\s+ON\s+(?:TABLE\s+)?["'`]?(\w+)["'`]?/gi,

    // REFERENCES table_name (foreign keys)
    REFERENCES: /REFERENCES\s+["'`]?(\w+)["'`]?/gi,
};

/**
 * Extract all table accesses from SQL string
 */
export function extractTableAccesses(sql: string): TableAccess[] {
    const accesses: TableAccess[] = [];
    const normalizedSQL = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

    // CREATE TABLE
    let match;
    while ((match = SQL_PATTERNS.CREATE_TABLE.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "CREATE", statement: match[0] });
    }
    SQL_PATTERNS.CREATE_TABLE.lastIndex = 0;

    // DROP TABLE
    while ((match = SQL_PATTERNS.DROP_TABLE.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "DROP", statement: match[0] });
    }
    SQL_PATTERNS.DROP_TABLE.lastIndex = 0;

    // ALTER TABLE
    while ((match = SQL_PATTERNS.ALTER_TABLE.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "ALTER", statement: match[0] });
    }
    SQL_PATTERNS.ALTER_TABLE.lastIndex = 0;

    // TRUNCATE
    while ((match = SQL_PATTERNS.TRUNCATE.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "TRUNCATE", statement: match[0] });
    }
    SQL_PATTERNS.TRUNCATE.lastIndex = 0;

    // INSERT
    while ((match = SQL_PATTERNS.INSERT.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "INSERT", statement: match[0] });
    }
    SQL_PATTERNS.INSERT.lastIndex = 0;

    // UPDATE
    while ((match = SQL_PATTERNS.UPDATE.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "UPDATE", statement: match[0] });
    }
    SQL_PATTERNS.UPDATE.lastIndex = 0;

    // DELETE
    while ((match = SQL_PATTERNS.DELETE.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "DELETE", statement: match[0] });
    }
    SQL_PATTERNS.DELETE.lastIndex = 0;

    // SELECT FROM
    while ((match = SQL_PATTERNS.SELECT_FROM.exec(normalizedSQL)) !== null) {
        // Extract all tables from FROM clause
        for (let i = 1; i < match.length; i++) {
            if (match[i]) {
                accesses.push({ table: match[i].toLowerCase(), operation: "SELECT", statement: match[0] });
            }
        }
    }
    SQL_PATTERNS.SELECT_FROM.lastIndex = 0;

    // JOIN
    while ((match = SQL_PATTERNS.JOIN.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "SELECT", statement: match[0] });
    }
    SQL_PATTERNS.JOIN.lastIndex = 0;

    // CREATE INDEX
    while ((match = SQL_PATTERNS.CREATE_INDEX.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "CREATE", statement: match[0] });
    }
    SQL_PATTERNS.CREATE_INDEX.lastIndex = 0;

    // GRANT
    while ((match = SQL_PATTERNS.GRANT.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "GRANT", statement: match[0] });
    }
    SQL_PATTERNS.GRANT.lastIndex = 0;

    // REVOKE
    while ((match = SQL_PATTERNS.REVOKE.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "REVOKE", statement: match[0] });
    }
    SQL_PATTERNS.REVOKE.lastIndex = 0;

    // REFERENCES (foreign keys)
    while ((match = SQL_PATTERNS.REFERENCES.exec(normalizedSQL)) !== null) {
        accesses.push({ table: match[1].toLowerCase(), operation: "SELECT", statement: match[0] });
    }
    SQL_PATTERNS.REFERENCES.lastIndex = 0;

    return accesses;
}

/**
 * Extract unique table names from SQL
 */
export function extractTablesFromSQL(sql: string): string[] {
    const accesses = extractTableAccesses(sql);
    const tables = new Set(accesses.map((a) => a.table));
    return Array.from(tables);
}

/**
 * Infer table policy from plugin name
 * Convention: @scope/plugin-{name} → {name}_* prefix allowed
 */
export function inferPolicyFromPluginName(pluginName: string): PluginTablePolicy {
    // Extract plugin short name
    // @yamajs/plugin-stripe → stripe
    // @betagors/yama-auth → auth
    const match = pluginName.match(/(?:plugin-|yama-)(\w+)$/i);
    const shortName = match ? match[1].toLowerCase() : pluginName.replace(/[@/]/g, "").toLowerCase();

    return {
        pluginName,
        allowedPrefixes: [`${shortName}_`],
        allowedTables: [],
        sharedTables: [...DEFAULT_SHARED_TABLES],
        mode: DEFAULT_POLICY_MODE,
    };
}

/**
 * Check if a table is allowed by the policy
 */
export function isTableAllowed(table: string, policy: PluginTablePolicy): boolean {
    const normalizedTable = table.toLowerCase();

    // Always allow shared tables
    if (policy.sharedTables.some((t) => t.toLowerCase() === normalizedTable)) {
        return true;
    }

    // Always allow explicitly allowed tables
    if (policy.allowedTables.some((t) => t.toLowerCase() === normalizedTable)) {
        return true;
    }

    // Check prefixes
    if (policy.allowedPrefixes.some((prefix) => normalizedTable.startsWith(prefix.toLowerCase()))) {
        return true;
    }

    // In permissive mode, allow by default
    if (policy.mode === "permissive") {
        return true;
    }

    // In strict mode, deny by default
    return false;
}

/**
 * Validate SQL against table policy
 */
export function validateTableAccess(sql: string, policy: PluginTablePolicy): SandboxValidationResult {
    const accesses = extractTableAccesses(sql);
    const violations: SandboxViolation[] = [];
    const tablesAccessed = new Set<string>();
    const operationsFound = new Set<SQLOperation>();

    for (const access of accesses) {
        tablesAccessed.add(access.table);
        operationsFound.add(access.operation);

        if (!isTableAllowed(access.table, policy)) {
            // Determine severity based on operation
            const isDestructive = ["DROP", "TRUNCATE", "DELETE", "ALTER"].includes(access.operation);

            violations.push({
                table: access.table,
                operation: access.operation,
                reason: `Table "${access.table}" is not allowed by policy. Allowed prefixes: [${policy.allowedPrefixes.join(", ")}]`,
                severity: isDestructive ? "error" : "warning",
            });
        }
    }

    return {
        valid: violations.filter((v) => v.severity === "error").length === 0,
        violations,
        tablesAccessed: Array.from(tablesAccessed),
        operationsFound: Array.from(operationsFound),
    };
}

/**
 * Merge two policies (user policy overrides inferred policy)
 */
export function mergePolicies(
    inferredPolicy: PluginTablePolicy,
    userPolicy: Partial<PluginTablePolicy>
): PluginTablePolicy {
    return {
        pluginName: userPolicy.pluginName ?? inferredPolicy.pluginName,
        allowedPrefixes: [
            ...inferredPolicy.allowedPrefixes,
            ...(userPolicy.allowedPrefixes ?? []),
        ],
        allowedTables: [
            ...inferredPolicy.allowedTables,
            ...(userPolicy.allowedTables ?? []),
        ],
        sharedTables: [
            ...inferredPolicy.sharedTables,
            ...(userPolicy.sharedTables ?? []),
        ],
        mode: userPolicy.mode ?? inferredPolicy.mode,
    };
}

/**
 * Get the list of shared tables
 */
export function getSharedTablesList(): string[] {
    return [...DEFAULT_SHARED_TABLES];
}

/**
 * Create a policy that allows all tables (for legacy plugins)
 */
export function createPermissivePolicy(pluginName: string): PluginTablePolicy {
    return {
        pluginName,
        allowedPrefixes: [],
        allowedTables: [],
        sharedTables: [...DEFAULT_SHARED_TABLES],
        mode: "permissive",
    };
}

/**
 * Format sandbox violations for display
 */
export function formatSandboxViolations(result: SandboxValidationResult): string {
    if (result.valid && result.violations.length === 0) {
        return "✅ No sandbox violations";
    }

    const lines: string[] = [];

    if (!result.valid) {
        lines.push("❌ Table Sandbox Policy Violations:");
    } else {
        lines.push("⚠️ Table Sandbox Policy Warnings:");
    }

    lines.push("");

    for (const violation of result.violations) {
        const icon = violation.severity === "error" ? "🔴" : "⚠️";
        lines.push(`  ${icon} ${violation.operation} on "${violation.table}"`);
        lines.push(`     ${violation.reason}`);
        lines.push("");
    }

    if (result.tablesAccessed.length > 0) {
        lines.push(`  Tables accessed: ${result.tablesAccessed.join(", ")}`);
    }

    return lines.join("\n");
}

/**
 * Analyze a plugin's migrations for table access
 */
export function analyzePluginTableAccess(
    migrations: Array<{ version: string; sql: string }>,
    policy: PluginTablePolicy
): {
    valid: boolean;
    byVersion: Map<string, SandboxValidationResult>;
    allTablesAccessed: string[];
    summary: string;
} {
    const byVersion = new Map<string, SandboxValidationResult>();
    const allTables = new Set<string>();
    let hasErrors = false;

    for (const migration of migrations) {
        const result = validateTableAccess(migration.sql, policy);
        byVersion.set(migration.version, result);

        for (const table of result.tablesAccessed) {
            allTables.add(table);
        }

        if (!result.valid) {
            hasErrors = true;
        }
    }

    const allTablesAccessed = Array.from(allTables);

    const summary = hasErrors
        ? `❌ Policy violations found in ${migrations.length} migration(s)`
        : `✅ All ${migrations.length} migration(s) comply with table policy`;

    return {
        valid: !hasErrors,
        byVersion,
        allTablesAccessed,
        summary,
    };
}
