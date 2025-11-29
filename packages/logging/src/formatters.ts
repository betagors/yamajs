import type { LogEntry } from "./types.js";

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
 * Format log entry as JSON
 */
export function formatJSON(entry: LogEntry): string {
  const jsonEntry: Record<string, unknown> = {
    timestamp: entry.timestamp.toISOString(),
    level: entry.levelName.toLowerCase(),
    message: entry.message,
  };

  // Add metadata if present
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    jsonEntry.metadata = entry.metadata;
  }

  // Add error details if present
  if (entry.error) {
    jsonEntry.error = {
      message: entry.error.message,
      name: entry.error.name,
      stack: entry.error.stack,
    };
  }

  return JSON.stringify(jsonEntry);
}

/**
 * Format log entry based on format type
 */
export function formatLogEntry(entry: LogEntry, format: "json" | "text"): string {
  return format === "json" ? formatJSON(entry) : formatText(entry);
}









