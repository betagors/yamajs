import { colors, error, warning, info, success } from "./cli-utils.ts";
import {
  YamaError,
  isYamaError,
  ErrorCodes,
  type ErrorCode,
} from "@betagors/yama-errors";

/**
 * Error context for CLI display
 */
export interface ErrorContext {
  type: ErrorContextType;
  code?: string;
  message: string;
  suggestions: string[];
  details?: Array<{ field?: string; message: string }>;
}

/**
 * Error context types for CLI categorization
 */
export type ErrorContextType =
  | "validation"
  | "auth"
  | "not_found"
  | "database"
  | "plugin"
  | "config"
  | "column_exists"
  | "foreign_key_violation"
  | "hash_mismatch"
  | "syntax_error"
  | "rate_limit"
  | "timeout"
  | "unknown";

/**
 * Map error codes to context types
 */
function getContextTypeFromCode(code: string): ErrorContextType {
  if (code.startsWith("VALIDATION_")) return "validation";
  if (code.startsWith("AUTH_") || code.startsWith("AUTHZ_")) return "auth";
  if (code.startsWith("NOT_FOUND_")) return "not_found";
  if (code.startsWith("DB_")) return "database";
  if (code.startsWith("PLUGIN_")) return "plugin";
  if (code.startsWith("CONFIG_")) return "config";
  if (code.startsWith("RATE_LIMIT")) return "rate_limit";
  if (code.startsWith("TIMEOUT")) return "timeout";
  
  // Handle specific database error codes
  if (code === ErrorCodes.DB_UNIQUE_VIOLATION) return "column_exists";
  if (code === ErrorCodes.DB_FOREIGN_KEY_VIOLATION) return "foreign_key_violation";
  
  return "unknown";
}

/**
 * Get icon for error type
 */
function getErrorIcon(type: ErrorContextType): string {
  switch (type) {
    case "validation": return "📝";
    case "auth": return "🔐";
    case "not_found": return "🔍";
    case "database": return "💾";
    case "plugin": return "🔌";
    case "config": return "⚙️";
    case "rate_limit": return "⏱️";
    case "timeout": return "⌛";
    case "column_exists": return "📋";
    case "foreign_key_violation": return "🔗";
    case "hash_mismatch": return "🔢";
    case "syntax_error": return "📜";
    default: return "❌";
  }
}

/**
 * Parse error and generate recovery suggestions
 */
export function parseError(err: unknown): ErrorContext {
  // Handle YamaError instances
  if (isYamaError(err)) {
    const yamaError = err as YamaError;
    const type = getContextTypeFromCode(yamaError.code);
    
    return {
      type,
      code: yamaError.code,
      message: yamaError.message,
      suggestions: yamaError.suggestions || getDefaultSuggestions(type, yamaError.code),
      details: yamaError.details,
    };
  }

  // Fallback to legacy pattern matching for non-YamaError errors
  const errorMessage = err instanceof Error ? err.message : String(err);
  const lowerMessage = errorMessage.toLowerCase();

  // Column already exists
  if (
    lowerMessage.includes("already exists") ||
    lowerMessage.includes("duplicate column") ||
    (lowerMessage.includes("column") && lowerMessage.includes("exists"))
  ) {
    return {
      type: "column_exists",
      message: errorMessage,
      suggestions: [
        "This usually means the migration was partially applied or there's schema drift",
        "Run: yama migration:check --diff to see the current state",
        "Run: yama migration:fix-drift to detect and fix drift",
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
        "Run: yama migration:check --verbose for more details",
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
        "Run: yama migration:check to see the current state",
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
 * Get default suggestions based on error type and code
 */
function getDefaultSuggestions(type: ErrorContextType, code: string): string[] {
  switch (type) {
    case "validation":
      return [
        "Check the request data for missing or invalid fields",
        "Review the API documentation for required fields",
      ];
    case "auth":
      return [
        "Verify your authentication credentials",
        "Check that your token hasn't expired",
        "Ensure you have the required permissions",
      ];
    case "not_found":
      return [
        "Verify the resource ID is correct",
        "Check that the resource hasn't been deleted",
      ];
    case "database":
      return [
        "Check database connection settings",
        "Verify database is running and accessible",
        "Run: yama schema:check to verify database state",
      ];
    case "plugin":
      return [
        "Ensure the plugin is installed: pnpm add <plugin-name>",
        "Check plugin configuration in yama.yaml",
        "Run: yama plugin:status to see plugin status",
      ];
    case "config":
      return [
        "Review your yama.yaml configuration",
        "Run: yama validate to check configuration",
        "Check for typos in configuration keys",
      ];
    case "rate_limit":
      return [
        "Wait before making more requests",
        "Consider implementing request batching",
        "Check rate limit headers in the response",
      ];
    case "timeout":
      return [
        "Check network connectivity",
        "Consider increasing timeout settings",
        "Verify the service is responsive",
      ];
    default:
      return [
        "Check the error message above for details",
        "Run: yama validate to check configuration",
        "See documentation for troubleshooting",
      ];
  }
}

/**
 * Print formatted error with recovery suggestions
 */
export function printError(
  err: unknown,
  context?: { migration?: string; step?: number; requestId?: string }
): void {
  const parsed = parseError(err);
  const icon = getErrorIcon(parsed.type);

  // Print error header with code
  if (parsed.code) {
    error(`${icon} [${parsed.code}] ${parsed.message}`);
  } else {
    error(`${icon} ${parsed.message}`);
  }

  // Print context info
  if (context?.migration) {
    info(`   Migration: ${context.migration}`);
  }
  if (context?.step !== undefined) {
    info(`   Step: ${context.step + 1}`);
  }
  if (context?.requestId) {
    info(`   Request ID: ${context.requestId}`);
  }

  // Print validation details if available
  if (parsed.details && parsed.details.length > 0) {
    console.log(colors.dim("\n   Validation errors:"));
    for (const detail of parsed.details) {
      if (detail.field) {
        console.log(colors.dim(`     • ${detail.field}: ${detail.message}`));
      } else {
        console.log(colors.dim(`     • ${detail.message}`));
      }
    }
  }

  // Print suggestions
  if (parsed.suggestions.length > 0) {
    warning("\n   Recovery options:");
    parsed.suggestions.forEach((suggestion) => {
      console.log(colors.dim(`     → ${suggestion}`));
    });
  }
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  success(`✅ ${message}`);
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  warning(`⚠️  ${message}`);
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  info(`ℹ️  ${message}`);
}

// Re-export error utilities for convenience
export { isYamaError, ErrorCodes } from "@betagors/yama-errors";
