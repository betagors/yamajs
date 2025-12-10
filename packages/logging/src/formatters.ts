import type { LogEntry, LogFormat } from "./types.js";
import { LogLevel } from "./types.js";

/**
 * ANSI color codes for pretty printing
 */
const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/**
 * Get color for log level
 */
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return COLORS.gray;
    case LogLevel.INFO:
      return COLORS.blue;
    case LogLevel.WARN:
      return COLORS.yellow;
    case LogLevel.ERROR:
      return COLORS.red;
    default:
      return COLORS.reset;
  }
}

/**
 * Format log entry as text (human-readable)
 */
export function formatText(entry: LogEntry): string {
  const timestamp = entry.timestamp.toISOString();
  const level = entry.levelName.padEnd(5);
  let output = `[${timestamp}] ${level}: ${entry.message}`;

  // Add metadata if present
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    output += ` ${JSON.stringify(entry.metadata)}`;
  }

  // Add error details if present
  if (entry.error) {
    output += `\nError: ${entry.error.message}`;
    if (entry.error.stack) {
      output += `\n${entry.error.stack}`;
    }
  }

  return output;
}

/**
 * Format log entry as pretty (colorized, human-readable for dev)
 */
export function formatPretty(entry: LogEntry): string {
  const timestamp = entry.timestamp.toLocaleTimeString();
  const levelColor = getLevelColor(entry.level);
  const level = entry.levelName.padEnd(5);

  let output = `${COLORS.dim}${timestamp}${COLORS.reset} ${levelColor}${level}${COLORS.reset} ${entry.message}`;

  // Add bindings (e.g., requestId) in cyan
  if (entry.bindings && Object.keys(entry.bindings).length > 0) {
    const bindingsStr = Object.entries(entry.bindings)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    output = `${COLORS.dim}${timestamp}${COLORS.reset} ${levelColor}${level}${COLORS.reset} ${COLORS.cyan}[${bindingsStr}]${COLORS.reset} ${entry.message}`;
  }

  // Add metadata if present (exclude bindings keys)
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    const metadataKeys = entry.bindings ? Object.keys(entry.bindings) : [];
    const filteredMetadata = Object.fromEntries(
      Object.entries(entry.metadata).filter(([k]) => !metadataKeys.includes(k))
    );
    if (Object.keys(filteredMetadata).length > 0) {
      output += ` ${COLORS.dim}${JSON.stringify(filteredMetadata)}${COLORS.reset}`;
    }
  }

  // Add error details if present
  if (entry.error) {
    output += `\n${COLORS.red}Error: ${entry.error.message}${COLORS.reset}`;
    if (entry.error.stack) {
      output += `\n${COLORS.dim}${entry.error.stack}${COLORS.reset}`;
    }
  }

  return output;
}

/**
 * Format log entry as JSON
 */
export function formatJSON(entry: LogEntry): string {
  const jsonEntry: Record<string, unknown> = {
    timestamp: entry.timestamp.toISOString(),
    level: entry.levelName.toLowerCase(),
    message: entry.message,
  };

  // Add bindings at top level (like pino)
  if (entry.bindings) {
    Object.assign(jsonEntry, entry.bindings);
  }

  // Add metadata if present
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    jsonEntry.metadata = entry.metadata;
  }

  // Add error details if present (improved structure)
  if (entry.error) {
    const stackLines = entry.error.stack?.split('\n').slice(1).map(line => line.trim()) ?? [];
    jsonEntry.error = {
      name: entry.error.name,
      message: entry.error.message,
      stack: stackLines, // Array of stack frames for easier processing
    };
    // Add cause if present (Error with cause)
    if ((entry.error as any).cause) {
      (jsonEntry.error as any).cause = {
        name: ((entry.error as any).cause as Error).name,
        message: ((entry.error as any).cause as Error).message,
      };
    }
  }

  return JSON.stringify(jsonEntry);
}

/**
 * Format log entry based on format type
 */
export function formatLogEntry(entry: LogEntry, format: LogFormat): string {
  switch (format) {
    case "json":
      return formatJSON(entry);
    case "pretty":
      return formatPretty(entry);
    case "text":
    default:
      return formatText(entry);
  }
}



















