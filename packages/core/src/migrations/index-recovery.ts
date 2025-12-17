/**
 * Index Recovery - Handle Failed Concurrent Index Creation
 *
 * PostgreSQL's CREATE INDEX CONCURRENTLY can leave invalid indexes
 * on failure. This module detects and recovers from such failures.
 */

/**
 * Invalid index information
 */
export interface InvalidIndex {
    /** Index name */
    indexName: string;

    /** Table the index belongs to */
    tableName: string;

    /** Schema name */
    schemaName: string;

    /** Index definition (CREATE INDEX statement) */
    definition: string;

    /** Whether the index is unique */
    isUnique: boolean;

    /** When the index was created (if available) */
    createdAt?: string;

    /** Reason the index is invalid */
    reason: string;
}

/**
 * Index recovery options
 */
export interface IndexRecoveryOptions {
    /** Only show what would be done */
    dryRun?: boolean;

    /** Retry creating the index after dropping */
    retryCreation?: boolean;

    /** Schema to check (default: public) */
    schema?: string;
}

/**
 * Index recovery result
 */
export interface IndexRecoveryResult {
    /** Indexes that were dropped */
    dropped: string[];

    /** Indexes that were recreated */
    recreated: string[];

    /** Errors encountered */
    errors: Array<{ index: string; error: string }>;

    /** Whether this was a dry run */
    dryRun: boolean;
}

/**
 * Index health check result
 */
export interface IndexHealthCheckResult {
    /** Total indexes checked */
    totalIndexes: number;

    /** Number of valid indexes */
    validIndexes: number;

    /** Number of invalid indexes */
    invalidIndexes: number;

    /** List of invalid indexes */
    invalid: InvalidIndex[];

    /** Overall health status */
    healthy: boolean;
}

/**
 * SQL to detect invalid indexes in PostgreSQL
 */
const INVALID_INDEXES_QUERY = `
  SELECT
    i.relname AS index_name,
    t.relname AS table_name,
    n.nspname AS schema_name,
    pg_get_indexdef(i.oid) AS definition,
    ix.indisunique AS is_unique,
    CASE
      WHEN NOT ix.indisvalid THEN 'Index is marked as invalid'
      WHEN ix.indisready = false THEN 'Index is not ready for use'
      ELSE 'Unknown'
    END AS reason
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE NOT ix.indisvalid
    OR ix.indisready = false
  ORDER BY n.nspname, t.relname, i.relname
`;

/**
 * SQL to get all indexes for a table
 */
const TABLE_INDEXES_QUERY = `
  SELECT
    i.relname AS index_name,
    pg_get_indexdef(i.oid) AS definition,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = $1
    AND n.nspname = $2
  ORDER BY i.relname
`;

/**
 * Get all invalid indexes from the database
 */
export async function getInvalidIndexes(
    sql: any,
    options?: { schema?: string }
): Promise<InvalidIndex[]> {
    try {
        const result = await sql.unsafe(INVALID_INDEXES_QUERY);

        const invalidIndexes: InvalidIndex[] = result
            .filter((row: any) => !options?.schema || row.schema_name === options.schema)
            .map((row: any) => ({
                indexName: row.index_name,
                tableName: row.table_name,
                schemaName: row.schema_name,
                definition: row.definition,
                isUnique: row.is_unique,
                reason: row.reason,
            }));

        return invalidIndexes;
    } catch (error) {
        // If the query fails (e.g., not PostgreSQL), return empty
        console.warn("Failed to check for invalid indexes:", error);
        return [];
    }
}

/**
 * Check index health for a specific table
 */
export async function checkTableIndexHealth(
    sql: any,
    tableName: string,
    schema: string = "public"
): Promise<IndexHealthCheckResult> {
    try {
        const result = await sql.unsafe(TABLE_INDEXES_QUERY, [tableName, schema]);

        const invalid: InvalidIndex[] = result
            .filter((row: any) => !row.is_valid || !row.is_ready)
            .map((row: any) => ({
                indexName: row.index_name,
                tableName,
                schemaName: schema,
                definition: row.definition,
                isUnique: row.is_unique,
                reason: !row.is_valid ? "Index is marked as invalid" : "Index is not ready",
            }));

        return {
            totalIndexes: result.length,
            validIndexes: result.length - invalid.length,
            invalidIndexes: invalid.length,
            invalid,
            healthy: invalid.length === 0,
        };
    } catch (error) {
        return {
            totalIndexes: 0,
            validIndexes: 0,
            invalidIndexes: 0,
            invalid: [],
            healthy: true, // Assume healthy if we can't check
        };
    }
}

/**
 * Drop invalid indexes safely
 */
export async function dropInvalidIndexes(
    sql: any,
    indexes: InvalidIndex[],
    options?: { dryRun?: boolean }
): Promise<{ dropped: string[]; errors: Array<{ index: string; error: string }> }> {
    const dropped: string[] = [];
    const errors: Array<{ index: string; error: string }> = [];

    for (const index of indexes) {
        const fullName = `"${index.schemaName}"."${index.indexName}"`;

        if (options?.dryRun) {
            dropped.push(fullName);
            continue;
        }

        try {
            // Use CONCURRENTLY to avoid locking
            await sql.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS ${fullName}`);
            dropped.push(fullName);
        } catch (error) {
            // If CONCURRENTLY fails (e.g., in transaction), try regular drop
            try {
                await sql.unsafe(`DROP INDEX IF EXISTS ${fullName}`);
                dropped.push(fullName);
            } catch (innerError) {
                errors.push({
                    index: fullName,
                    error: innerError instanceof Error ? innerError.message : String(innerError),
                });
            }
        }
    }

    return { dropped, errors };
}

/**
 * Recreate an index from its definition
 */
export async function recreateIndex(
    sql: any,
    index: InvalidIndex,
    options?: { dryRun?: boolean; concurrent?: boolean }
): Promise<{ success: boolean; error?: string }> {
    if (options?.dryRun) {
        return { success: true };
    }

    try {
        // Modify definition to use CONCURRENTLY if requested
        let definition = index.definition;
        if (options?.concurrent && !definition.toLowerCase().includes("concurrently")) {
            definition = definition.replace(
                /CREATE\s+(UNIQUE\s+)?INDEX/i,
                `CREATE $1INDEX CONCURRENTLY`
            );
        }

        await sql.unsafe(definition);
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Recover from failed concurrent index creation
 */
export async function recoverInvalidIndexes(
    sql: any,
    options: IndexRecoveryOptions = {}
): Promise<IndexRecoveryResult> {
    const result: IndexRecoveryResult = {
        dropped: [],
        recreated: [],
        errors: [],
        dryRun: options.dryRun ?? false,
    };

    // Get all invalid indexes
    const invalidIndexes = await getInvalidIndexes(sql, { schema: options.schema });

    if (invalidIndexes.length === 0) {
        return result;
    }

    // Store definitions before dropping
    const definitions = new Map<string, InvalidIndex>();
    for (const index of invalidIndexes) {
        const fullName = `"${index.schemaName}"."${index.indexName}"`;
        definitions.set(fullName, index);
    }

    // Drop invalid indexes
    const dropResult = await dropInvalidIndexes(sql, invalidIndexes, {
        dryRun: options.dryRun,
    });

    result.dropped = dropResult.dropped;
    result.errors.push(...dropResult.errors);

    // Optionally recreate indexes
    if (options.retryCreation) {
        for (const [fullName, index] of Array.from(definitions.entries())) {
            if (!result.dropped.includes(fullName)) {
                continue; // Skip if drop failed
            }

            const recreateResult = await recreateIndex(sql, index, {
                dryRun: options.dryRun,
                concurrent: true,
            });

            if (recreateResult.success) {
                result.recreated.push(fullName);
            } else {
                result.errors.push({
                    index: fullName,
                    error: recreateResult.error || "Unknown error",
                });
            }
        }
    }

    return result;
}

/**
 * Format index recovery result for display
 */
export function formatIndexRecoveryResult(result: IndexRecoveryResult): string {
    const lines: string[] = [];

    if (result.dryRun) {
        lines.push("🔍 DRY RUN - No actual changes made");
        lines.push("");
    }

    if (result.dropped.length > 0) {
        lines.push(`${result.dryRun ? "Would drop" : "Dropped"} ${result.dropped.length} invalid index(es):`);
        for (const index of result.dropped) {
            lines.push(`  ✅ ${index}`);
        }
        lines.push("");
    }

    if (result.recreated.length > 0) {
        lines.push(`${result.dryRun ? "Would recreate" : "Recreated"} ${result.recreated.length} index(es):`);
        for (const index of result.recreated) {
            lines.push(`  ✅ ${index}`);
        }
        lines.push("");
    }

    if (result.errors.length > 0) {
        lines.push(`Errors (${result.errors.length}):`);
        for (const error of result.errors) {
            lines.push(`  ❌ ${error.index}: ${error.error}`);
        }
        lines.push("");
    }

    if (result.dropped.length === 0 && result.errors.length === 0) {
        lines.push("✅ No invalid indexes found");
    }

    return lines.join("\n");
}

/**
 * Format index health check result for display
 */
export function formatIndexHealthCheck(result: IndexHealthCheckResult): string {
    const lines: string[] = [];

    if (result.healthy) {
        lines.push("✅ All indexes are healthy");
        lines.push(`   Total: ${result.totalIndexes} | Valid: ${result.validIndexes}`);
    } else {
        lines.push("❌ Invalid indexes detected");
        lines.push(`   Total: ${result.totalIndexes} | Valid: ${result.validIndexes} | Invalid: ${result.invalidIndexes}`);
        lines.push("");
        lines.push("Invalid indexes:");
        for (const index of result.invalid) {
            lines.push(`  🔴 ${index.schemaName}.${index.indexName} on ${index.tableName}`);
            lines.push(`     Reason: ${index.reason}`);
            lines.push(`     Definition: ${index.definition}`);
        }
    }

    return lines.join("\n");
}
