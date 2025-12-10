import type {
  LogEntry,
  Transport,
  ConsoleTransportConfig,
  LogFormat,
} from "../types.js";
import { formatLogEntry } from "../formatters.js";
import { LogLevel } from "../types.js";

/**
 * ANSI color codes for console output
 */
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

/**
 * Get color for log level
 */
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return colors.dim;
    case LogLevel.INFO:
      return colors.cyan;
    case LogLevel.WARN:
      return colors.yellow;
    case LogLevel.ERROR:
      return colors.red;
  }
}

/**
 * Console transport implementation
 */
export class ConsoleTransport implements Transport {
  private config: ConsoleTransportConfig;
  private format: LogFormat;

  constructor(config: ConsoleTransportConfig) {
    this.config = config;
    this.format = config.format || "text";
  }

  write(entry: LogEntry): void {
    const formatted = formatLogEntry(entry, this.format);

    // Use appropriate console method based on level
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(this.formatOutput(formatted, entry));
        break;
      case LogLevel.INFO:
        console.log(this.formatOutput(formatted, entry));
        break;
      case LogLevel.WARN:
        console.warn(this.formatOutput(formatted, entry));
        break;
      case LogLevel.ERROR:
        console.error(this.formatOutput(formatted, entry));
        break;
    }
  }

  /**
   * Format output with colors if needed
   * Note: 'pretty' format is already colorized by formatPretty()
   */
  private formatOutput(formatted: string, entry: LogEntry): string {
    // Pretty format is already colorized by formatters.ts
    if (this.format === "pretty") {
      return formatted;
    }
    // JSON format should not be colorized
    if (this.format === "json") {
      return formatted;
    }
    // Text format: apply colors if enabled
    if (this.config.colors !== false) {
      const color = getLevelColor(entry.level);
      return `${color}${formatted}${colors.reset}`;
    }
    return formatted;
  }
}

/**
 * Create a console transport
 */
export function createConsoleTransport(
  config: ConsoleTransportConfig
): ConsoleTransport {
  return new ConsoleTransport(config);
}

