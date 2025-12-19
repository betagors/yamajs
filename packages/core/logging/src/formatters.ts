import { LogLevel } from "../../../../../../../../../../core/logging/src/levels.js";
import type { LogEvent } from "../../../../../../../../../../core/logging/src/event.js";

export type LogFormat = "json" | "text" | "pretty";

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
  magenta: "\x1b[35m",
};

/**
 * Get color for log level
 */
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.TRACE:
      return COLORS.dim;
    case LogLevel.DEBUG:
      return COLORS.gray;
    case LogLevel.INFO:
      return COLORS.blue;
    case LogLevel.WARN:
      return COLORS.yellow;
    case LogLevel.ERROR:
      return COLORS.red;
    case LogLevel.FATAL:
      return COLORS.magenta;
    default:
      return COLORS.reset;
  }
}

/**
 * Format log entry as text (human-readable)
 */
export function formatText(event: LogEvent): string {
  const level = event.levelName.padEnd(5);
  let output = `[${event.timestamp}] ${level}: ${event.message}`;

  if (event.scope) {
    output = `[${event.timestamp}] [${event.scope}] ${level}: ${event.message}`;
  }

  // Add metadata if present
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    output += ` ${JSON.stringify(event.metadata)}`;
  }

  // Add error details if present
  if (event.error) {
    output += `\nError: ${event.error.message}`;
    if (event.error.stack) {
      output += `\n${event.error.stack}`;
    }
  }

  return output;
}

/**
 * Format log entry as pretty (colorized, human-readable for dev)
 */
export function formatPretty(event: LogEvent): string {
  // Use a shorter timestamp for local dev
  const time = new Date(event.timestamp).toLocaleTimeString();
  const levelColor = getLevelColor(event.level);
  const level = event.levelName.padEnd(5);
  const scope = event.scope ? `${COLORS.cyan}[${event.scope}]${COLORS.reset} ` : "";

  let output = `${COLORS.dim}${time}${COLORS.reset} ${scope}${levelColor}${level}${COLORS.reset} ${event.message}`;

  // Add metadata if present
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    output += ` ${COLORS.dim}${JSON.stringify(event.metadata)}${COLORS.reset}`;
  }

  // Add error details if present
  if (event.error) {
    output += `\n${COLORS.red}Error: ${event.error.message}${COLORS.reset}`;
    if (event.error.stack) {
      output += `\n${COLORS.dim}${event.error.stack}${COLORS.reset}`;
    }
  }

  return output;
}

/**
 * Format log entry as JSON
 */
export function formatJSON(event: LogEvent): string {
  return JSON.stringify(event);
}

/**
 * Format log entry based on format type
 */
export function formatLogEntry(event: LogEvent, format: LogFormat): string {
  switch (format) {
    case "json":
      return formatJSON(event);
    case "pretty":
      return formatPretty(event);
    case "text":
    default:
      return formatText(event);
  }
}
