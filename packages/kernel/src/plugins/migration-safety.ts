/**
 * Migration Safety Analysis
 * 
 * Analyzes migration SQL to detect destructive operations
 * and provide safety warnings before execution.
 */

/**
 * Types of potentially destructive operations
 */
export type DestructiveOperationType =
    | 'DROP_TABLE'
    | 'DROP_COLUMN'
    | 'DROP_INDEX'
    | 'DROP_CONSTRAINT'
    | 'DROP_DATABASE'
    | 'DROP_SCHEMA'
    | 'TRUNCATE'
    | 'DELETE_ALL'
    | 'ALTER_TYPE'
    | 'RENAME_COLUMN';

/**
 * Detected destructive operation
 */
export interface DestructiveOperation {
    type: DestructiveOperationType;
    target: string;  // Table/column/index name
    sql: string;     // The actual SQL statement
    line?: number;   // Line number in migration file
    severity: 'warning' | 'danger';
    message: string;
    reversible: boolean;
}

/**
 * Migration safety analysis result
 */
export interface MigrationSafetyAnalysis {
    /** Overall safety assessment */
    safe: boolean;

    /** Requires user confirmation before proceeding */
    requiresConfirmation: boolean;

    /** Suggests creating a backup before proceeding */
    requiresBackup: boolean;

    /** List of detected destructive operations */
    destructiveOperations: DestructiveOperation[];

    /** Warning messages */
    warnings: string[];

    /** Affected tables */
    affectedTables: string[];

    /** Estimated risk level */
    riskLevel: 'low' | 'medium' | 'high' | 'critical';

    /** Human-readable summary */
    summary: string;
}

/**
 * Patterns to detect destructive SQL operations
 */
const DESTRUCTIVE_PATTERNS: Array<{
    pattern: RegExp;
    type: DestructiveOperationType;
    severity: 'warning' | 'danger';
    reversible: boolean;
    getMessage: (match: RegExpMatchArray) => string;
}> = [
        {
            pattern: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
            type: 'DROP_TABLE',
            severity: 'danger',
            reversible: false,
            getMessage: (m) => `Dropping table "${m[1]}" will permanently delete all data`,
        },
        {
            pattern: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
            type: 'DROP_COLUMN',
            severity: 'danger',
            reversible: false,
            getMessage: (m) => `Dropping column "${m[2]}" from table "${m[1]}" will delete column data`,
        },
        {
            pattern: /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:CONCURRENTLY\s+)?["']?(\w+)["']?/gi,
            type: 'DROP_INDEX',
            severity: 'warning',
            reversible: true,
            getMessage: (m) => `Dropping index "${m[1]}" may affect query performance`,
        },
        {
            pattern: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
            type: 'DROP_CONSTRAINT',
            severity: 'warning',
            reversible: true,
            getMessage: (m) => `Dropping constraint "${m[2]}" from table "${m[1]}" may affect data integrity`,
        },
        {
            pattern: /DROP\s+DATABASE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
            type: 'DROP_DATABASE',
            severity: 'danger',
            reversible: false,
            getMessage: (m) => `Dropping database "${m[1]}" will permanently delete ALL data`,
        },
        {
            pattern: /DROP\s+SCHEMA\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?\s*(?:CASCADE)?/gi,
            type: 'DROP_SCHEMA',
            severity: 'danger',
            reversible: false,
            getMessage: (m) => `Dropping schema "${m[1]}" will delete all objects in the schema`,
        },
        {
            pattern: /TRUNCATE\s+(?:TABLE\s+)?["']?(\w+)["']?/gi,
            type: 'TRUNCATE',
            severity: 'danger',
            reversible: false,
            getMessage: (m) => `Truncating table "${m[1]}" will delete all rows`,
        },
        {
            pattern: /DELETE\s+FROM\s+["']?(\w+)["']?\s*(?:;|$)/gi,
            type: 'DELETE_ALL',
            severity: 'danger',
            reversible: false,
            getMessage: (m) => `DELETE without WHERE clause will delete all rows from "${m[1]}"`,
        },
        {
            pattern: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ALTER\s+COLUMN\s+["']?(\w+)["']?\s+(?:SET\s+DATA\s+)?TYPE/gi,
            type: 'ALTER_TYPE',
            severity: 'warning',
            reversible: false,
            getMessage: (m) => `Changing type of column "${m[2]}" in table "${m[1]}" may cause data loss`,
        },
        {
            pattern: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+RENAME\s+COLUMN\s+["']?(\w+)["']?\s+TO\s+["']?(\w+)["']?/gi,
            type: 'RENAME_COLUMN',
            severity: 'warning',
            reversible: true,
            getMessage: (m) => `Renaming column "${m[2]}" to "${m[3]}" in table "${m[1]}" may break existing queries`,
        },
    ];

/**
 * Pattern to extract table names from SQL
 */
const TABLE_PATTERNS = [
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi,
    /ALTER\s+TABLE\s+["']?(\w+)["']?/gi,
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
    /INSERT\s+INTO\s+["']?(\w+)["']?/gi,
    /UPDATE\s+["']?(\w+)["']?/gi,
    /DELETE\s+FROM\s+["']?(\w+)["']?/gi,
    /TRUNCATE\s+(?:TABLE\s+)?["']?(\w+)["']?/gi,
    /FROM\s+["']?(\w+)["']?/gi,
    /JOIN\s+["']?(\w+)["']?/gi,
];

/**
 * Analyze migration SQL for safety
 * 
 * @param sql - The SQL content to analyze (can be a single statement or multiple)
 * @param migrationName - Name of the migration (for error messages)
 * @returns Safety analysis result
 */
export function analyzeMigrationSafety(
    sql: string,
    migrationName?: string
): MigrationSafetyAnalysis {
    const destructiveOperations: DestructiveOperation[] = [];
    const warnings: string[] = [];
    const affectedTables = new Set<string>();

    // Split by lines for line number tracking
    const lines = sql.split('\n');

    // Detect destructive operations
    for (const { pattern, type, severity, reversible, getMessage } of DESTRUCTIVE_PATTERNS) {
        // Reset pattern lastIndex for re-use
        pattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.exec(sql)) !== null) {
            // Find line number
            const beforeMatch = sql.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;

            const operation: DestructiveOperation = {
                type,
                target: match[1] || 'unknown',
                sql: match[0],
                line: lineNumber,
                severity,
                reversible,
                message: getMessage(match),
            };

            destructiveOperations.push(operation);

            if (match[1]) {
                affectedTables.add(match[1].toLowerCase());
            }
        }
    }

    // Extract all affected tables
    for (const pattern of TABLE_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(sql)) !== null) {
            if (match[1]) {
                affectedTables.add(match[1].toLowerCase());
            }
        }
    }

    // Calculate risk level
    const dangerCount = destructiveOperations.filter(op => op.severity === 'danger').length;
    const warningCount = destructiveOperations.filter(op => op.severity === 'warning').length;
    const irreversibleCount = destructiveOperations.filter(op => !op.reversible).length;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (dangerCount >= 3 || irreversibleCount >= 2) {
        riskLevel = 'critical';
    } else if (dangerCount >= 1) {
        riskLevel = 'high';
    } else if (warningCount >= 1) {
        riskLevel = 'medium';
    } else {
        riskLevel = 'low';
    }

    // Generate warnings
    if (destructiveOperations.some(op => op.type === 'DROP_DATABASE')) {
        warnings.push('⚠️  CRITICAL: This migration drops a database!');
    }
    if (destructiveOperations.some(op => op.type === 'DROP_TABLE')) {
        warnings.push('⚠️  Tables will be dropped and data will be lost permanently');
    }
    if (destructiveOperations.some(op => op.type === 'DROP_COLUMN')) {
        warnings.push('⚠️  Columns will be dropped and data will be lost');
    }
    if (destructiveOperations.some(op => op.type === 'TRUNCATE' || op.type === 'DELETE_ALL')) {
        warnings.push('⚠️  All rows will be deleted from one or more tables');
    }
    if (destructiveOperations.some(op => op.type === 'ALTER_TYPE')) {
        warnings.push('⚠️  Column types are being changed, which may cause data loss');
    }

    // Generate summary
    let summary: string;
    if (destructiveOperations.length === 0) {
        summary = 'Migration appears safe with no destructive operations detected';
    } else {
        const parts: string[] = [];
        if (dangerCount > 0) {
            parts.push(`${dangerCount} dangerous operation${dangerCount > 1 ? 's' : ''}`);
        }
        if (warningCount > 0) {
            parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
        }
        summary = `Migration contains ${parts.join(' and ')}`;
        if (migrationName) {
            summary = `[${migrationName}] ${summary}`;
        }
    }

    return {
        safe: destructiveOperations.length === 0,
        requiresConfirmation: dangerCount > 0,
        requiresBackup: dangerCount > 0 || irreversibleCount > 0,
        destructiveOperations,
        warnings,
        affectedTables: Array.from(affectedTables),
        riskLevel,
        summary,
    };
}

/**
 * Analyze multiple migrations
 */
export function analyzeMultipleMigrations(
    migrations: Array<{ name: string; sql: string }>
): MigrationSafetyAnalysis {
    const allOperations: DestructiveOperation[] = [];
    const allWarnings: string[] = [];
    const allTables = new Set<string>();

    for (const migration of migrations) {
        const analysis = analyzeMigrationSafety(migration.sql, migration.name);
        allOperations.push(...analysis.destructiveOperations);
        allWarnings.push(...analysis.warnings);
        analysis.affectedTables.forEach(t => allTables.add(t));
    }

    // Deduplicate warnings
    const uniqueWarnings = [...new Set(allWarnings)];

    const dangerCount = allOperations.filter(op => op.severity === 'danger').length;
    const irreversibleCount = allOperations.filter(op => !op.reversible).length;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (dangerCount >= 3 || irreversibleCount >= 2) {
        riskLevel = 'critical';
    } else if (dangerCount >= 1) {
        riskLevel = 'high';
    } else if (allOperations.length >= 1) {
        riskLevel = 'medium';
    } else {
        riskLevel = 'low';
    }

    return {
        safe: allOperations.length === 0,
        requiresConfirmation: dangerCount > 0,
        requiresBackup: dangerCount > 0 || irreversibleCount > 0,
        destructiveOperations: allOperations,
        warnings: uniqueWarnings,
        affectedTables: Array.from(allTables),
        riskLevel,
        summary: `Analyzed ${migrations.length} migration(s): ${allOperations.length} destructive operation(s) detected`,
    };
}

/**
 * Format safety analysis for CLI display
 */
export function formatSafetyAnalysis(analysis: MigrationSafetyAnalysis): string {
    const lines: string[] = [];

    // Risk level badge
    const riskBadges: Record<string, string> = {
        low: '✅ LOW RISK',
        medium: '⚠️  MEDIUM RISK',
        high: '🔶 HIGH RISK',
        critical: '🔴 CRITICAL RISK',
    };
    lines.push(riskBadges[analysis.riskLevel]);
    lines.push('');

    // Summary
    lines.push(analysis.summary);
    lines.push('');

    // Destructive operations
    if (analysis.destructiveOperations.length > 0) {
        lines.push('Destructive Operations:');
        for (const op of analysis.destructiveOperations) {
            const icon = op.severity === 'danger' ? '🔴' : '⚠️';
            const reversibleNote = op.reversible ? '' : ' (IRREVERSIBLE)';
            lines.push(`  ${icon} ${op.type}: ${op.target}${reversibleNote}`);
            lines.push(`     ${op.message}`);
            if (op.line) {
                lines.push(`     Line ${op.line}: ${op.sql}`);
            }
        }
        lines.push('');
    }

    // Warnings
    if (analysis.warnings.length > 0) {
        lines.push('Warnings:');
        for (const warning of analysis.warnings) {
            lines.push(`  ${warning}`);
        }
        lines.push('');
    }

    // Affected tables
    if (analysis.affectedTables.length > 0) {
        lines.push(`Affected Tables: ${analysis.affectedTables.join(', ')}`);
        lines.push('');
    }

    // Recommendations
    if (analysis.requiresBackup) {
        lines.push('📦 Recommendation: Create a backup before proceeding');
    }
    if (analysis.requiresConfirmation) {
        lines.push('⚠️  This migration requires explicit confirmation to proceed');
    }

    return lines.join('\n');
}

/**
 * Check if a SQL string is likely a migration function (not raw SQL)
 */
export function isMigrationFunction(content: unknown): content is () => Promise<void> | void {
    return typeof content === 'function';
}

/**
 * Generate confirmation prompt message for destructive migrations
 */
export function getConfirmationPrompt(analysis: MigrationSafetyAnalysis): string {
    if (!analysis.requiresConfirmation) {
        return '';
    }

    const criticalOps = analysis.destructiveOperations
        .filter(op => op.severity === 'danger' && !op.reversible)
        .map(op => `${op.type} ${op.target}`)
        .join(', ');

    if (criticalOps) {
        return `Type "${criticalOps}" to confirm destructive operations:`;
    }

    return 'Type "yes" to confirm:';
}

/**
 * Validate confirmation input
 */
export function validateConfirmation(
    input: string,
    analysis: MigrationSafetyAnalysis
): boolean {
    if (!analysis.requiresConfirmation) {
        return true;
    }

    const criticalOps = analysis.destructiveOperations
        .filter(op => op.severity === 'danger' && !op.reversible)
        .map(op => `${op.type} ${op.target}`)
        .join(', ');

    if (criticalOps) {
        return input.trim().toLowerCase() === criticalOps.toLowerCase();
    }

    return input.trim().toLowerCase() === 'yes';
}
