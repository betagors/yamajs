import { colors, error, warning, info } from "./cli-utils.js";

/**
 * Parse error message and extract context
 */
export interface ErrorContext {
  type: "column_exists" | "foreign_key_violation" | "hash_mismatch" | "syntax_error" | "unknown";
  message: string;
  suggestions: string[];
}

/**
 * Parse error and generate recovery suggestions
 */
export function parseError(err: unknown): ErrorContext {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const lowerMessage = errorMessage.toLowerCase();

  // Column already exists
  if (
    lowerMessage.includes("already exists") ||
    lowerMessage.includes("duplicate column") ||
    lowerMessage.includes("column") && lowerMessage.includes("exists")
  ) {
    return {
      type: "column_exists",
      message: errorMessage,
      suggestions: [
        "This usually means the migration was partially applied or there's schema drift",
        "Run: yama schema:check --diff to see the current state",
        "Run: yama schema:fix-drift to detect and fix drift",
      ],
    };
  }

  // Foreign key violation
  if (
    lowerMessage.includes("foreign key") ||
    lowerMessage.includes("constraint") ||
    lowerMessage.includes("references")
  ) {
    return {
      type: "foreign_key_violation",
      message: errorMessage,
      suggestions: [
        "Check if the referenced table has data matching the foreign key",
        "Run: yama schema:check --verbose for more details",
        "Verify data integrity before applying the migration",
      ],
    };
  }

  // Hash mismatch
  if (lowerMessage.includes("hash") || lowerMessage.includes("model")) {
    return {
      type: "hash_mismatch",
      message: errorMessage,
      suggestions: [
        "The migration's from_model.hash doesn't match the current database state",
        "This usually means migrations were applied out of order or manually modified",
        "Run: yama schema:check to see the current state",
        "You may need to manually reconcile the database state",
      ],
    };
  }

  // SQL syntax error
  if (
    lowerMessage.includes("syntax") ||
    lowerMessage.includes("parse") ||
    lowerMessage.includes("invalid")
  ) {
    return {
      type: "syntax_error",
      message: errorMessage,
      suggestions: [
        "Check the migration SQL for syntax errors",
        "Run: yama schema:validate-migrations to check all migrations",
        "Review the generated SQL file",
      ],
    };
  }

  // Unknown error
  return {
    type: "unknown",
    message: errorMessage,
    suggestions: [
      "Check the error message above for details",
      "Run: yama schema:check to verify current state",
      "Review migration files for issues",
    ],
  };
}

/**
 * Print formatted error with recovery suggestions
 */
export function printError(err: unknown, context?: { migration?: string; step?: number }): void {
  const parsed = parseError(err);

  error(parsed.message);

  if (context?.migration) {
    info(`Migration: ${context.migration}`);
  }
  if (context?.step !== undefined) {
    info(`Step: ${context.step + 1}`);
  }

  if (parsed.suggestions.length > 0) {
    warning("\nRecovery options:");
    parsed.suggestions.forEach((suggestion) => {
      console.log(colors.dim(`  → ${suggestion}`));
    });
  }
}

