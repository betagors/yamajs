import type {
  LogEntry,
  Transport,
  LogLevel,
  LoggingPluginConfig,
} from "./types.js";
import { LogLevel as LogLevelEnum, parseLogLevel, getLogLevelName } from "./types.js";
import { createConsoleTransport } from "./transports/console.js";
import { createFileTransport } from "./transports/file.js";
import { createS3Transport } from "./transports/s3.js";
import type {
  ConsoleTransportConfig,
  FileTransportConfig,
  S3TransportConfig,
} from "./types.js";

/**
 * Logger class that manages multiple transports and log levels
 */
export class Logger {
  private transports: Transport[] = [];
  private level: LogLevelEnum;
  private config: LoggingPluginConfig;
  private bindings: Record<string, unknown> = {};

  constructor(config: LoggingPluginConfig, bindings?: Record<string, unknown>) {
    this.config = config;
    this.level = parseLogLevel(config.level || "info");
    this.bindings = bindings ?? {};
  }

  /**
   * Create a child logger with additional bound context
   * Useful for request-scoped logging with requestId, userId, etc.
   */
  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config, {
      ...this.bindings,
      ...bindings,
    });
    // Share transports with parent
    childLogger.transports = this.transports;
    return childLogger;
  }

  /**
   * Add a transport to the logger
   */
  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport from the logger
   */
  removeTransport(transport: Transport): void {
    const index = this.transports.indexOf(transport);
    if (index > -1) {
      this.transports.splice(index, 1);
    }
  }

  /**
   * Get all transports
   */
  getTransports(): Transport[] {
    return [...this.transports];
  }

  /**
   * Set log level
   */
  setLevel(level: string): void {
    this.level = parseLogLevel(level);
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevelEnum {
    return this.level;
  }

  /**
   * Get current bindings
   */
  getBindings(): Record<string, unknown> {
    return { ...this.bindings };
  }

  /**
   * Create a logger for a specific group (feature/module)
   * Group loggers respect per-group log level settings
   */
  group(name: string): Logger {
    return this.child({ group: name });
  }

  /**
   * Get the log level for a specific group
   */
  private getGroupLevel(group?: string): LogLevelEnum | null {
    if (!group || !this.config.groups) {
      return null;
    }
    const groupLevel = this.config.groups[group];
    if (!groupLevel) {
      return null;
    }
    if (groupLevel === 'off') {
      return Infinity as LogLevelEnum; // Never log
    }
    return parseLogLevel(groupLevel);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevelEnum): boolean {
    // Check group-specific level first
    const group = this.bindings.group as string | undefined;
    const groupLevel = this.getGroupLevel(group);
    if (groupLevel !== null) {
      return level >= groupLevel;
    }
    return level >= this.level;
  }

  /**
   * Apply redaction to metadata
   */
  private redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const redactConfig = this.config.redact;
    if (!redactConfig) {
      return metadata;
    }

    const replacement = redactConfig.replacement ?? "[REDACTED]";
    const keysToRedact = new Set(redactConfig.keys?.map(k => k.toLowerCase()) ?? []);

    const redact = (obj: Record<string, unknown>, path: string[] = []): Record<string, unknown> => {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        const currentPath = [...path, key].join(".");

        // Check if key should be redacted
        if (keysToRedact.has(keyLower)) {
          result[key] = replacement;
          continue;
        }

        // Check if path should be redacted
        if (redactConfig.paths?.includes(currentPath)) {
          result[key] = replacement;
          continue;
        }

        // Recursively redact nested objects
        if (value && typeof value === "object" && !Array.isArray(value)) {
          result[key] = redact(value as Record<string, unknown>, [...path, key]);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return redact(metadata);
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevelEnum,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    // Merge bindings with metadata (bindings are lower priority)
    const mergedMetadata = metadata
      ? this.redactMetadata({ ...this.bindings, ...metadata })
      : Object.keys(this.bindings).length > 0
        ? this.redactMetadata(this.bindings)
        : undefined;

    return {
      timestamp: new Date(),
      level,
      levelName: getLogLevelName(level),
      message,
      metadata: mergedMetadata,
      error,
      bindings: Object.keys(this.bindings).length > 0 ? this.bindings : undefined,
    };
  }

  /**
   * Write log entry to all transports
   */
  private async writeToTransports(entry: LogEntry): Promise<void> {
    const promises = this.transports.map(async (transport) => {
      try {
        await transport.write(entry);
      } catch (error) {
        // Log transport errors to console but don't throw
        console.error("Error writing to transport:", error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevelEnum.DEBUG)) {
      return;
    }

    const entry = this.createLogEntry(LogLevelEnum.DEBUG, message, metadata);
    this.writeToTransports(entry).catch((err) => {
      console.error("Error logging debug:", err);
    });
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevelEnum.INFO)) {
      return;
    }

    const entry = this.createLogEntry(LogLevelEnum.INFO, message, metadata);
    this.writeToTransports(entry).catch((err) => {
      console.error("Error logging info:", err);
    });
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevelEnum.WARN)) {
      return;
    }

    const entry = this.createLogEntry(LogLevelEnum.WARN, message, metadata);
    this.writeToTransports(entry).catch((err) => {
      console.error("Error logging warn:", err);
    });
  }

  /**
   * Log an error message
   */
  error(
    message: string,
    error?: Error,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(LogLevelEnum.ERROR)) {
      return;
    }

    const entry = this.createLogEntry(
      LogLevelEnum.ERROR,
      message,
      metadata,
      error
    );
    this.writeToTransports(entry).catch((err) => {
      console.error("Error logging error:", err);
    });
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    const promises = this.transports.map(async (transport) => {
      if (transport.flush) {
        try {
          await transport.flush();
        } catch (error) {
          console.error("Error flushing transport:", error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    const promises = this.transports.map(async (transport) => {
      if (transport.close) {
        try {
          await transport.close();
        } catch (error) {
          console.error("Error closing transport:", error);
        }
      }
    });

    await Promise.allSettled(promises);
  }
}

/**
 * Detect if running in development mode
 */
function isDevelopment(): boolean {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  const yamaEnv = process.env.YAMA_ENV?.toLowerCase();
  return nodeEnv === 'development' || nodeEnv === 'dev' ||
    yamaEnv === 'development' || yamaEnv === 'dev';
}

/**
 * Create transports from configuration
 */
export async function createTransports(
  config: LoggingPluginConfig,
  context?: {
    getPluginAPI?: (name: string) => any;
  }
): Promise<Transport[]> {
  const transports: Transport[] = [];

  // Auto-detect format based on environment
  const autoPretty = config.autoPretty !== false && isDevelopment();
  const defaultFormat = autoPretty ? 'pretty' : 'text';

  if (!config.transports || config.transports.length === 0) {
    // Default to console transport if none specified
    transports.push(createConsoleTransport({ type: "console", format: defaultFormat }));
    return transports;
  }

  for (const transportConfig of config.transports) {
    try {
      if (transportConfig.type === "console") {
        transports.push(
          createConsoleTransport(transportConfig as ConsoleTransportConfig)
        );
      } else if (transportConfig.type === "file") {
        const fileConfig = transportConfig as FileTransportConfig;
        let bucket = null;

        // Try to get fs plugin API
        if (context?.getPluginAPI) {
          const fsApi = context.getPluginAPI("@betagors/yama-fs");
          if (fsApi?.bucket) {
            bucket = fsApi.bucket;
          }
        }

        // Create transport even if bucket is null (will fail gracefully)
        transports.push(createFileTransport(fileConfig, bucket));
      } else if (transportConfig.type === "s3") {
        const s3Config = transportConfig as S3TransportConfig;
        let bucket = null;

        // Try to get s3 plugin API
        if (context?.getPluginAPI) {
          const s3Api = context.getPluginAPI("@betagors/yama-s3");
          if (s3Api?.buckets && s3Config.bucket) {
            bucket = s3Api.buckets[s3Config.bucket];
          }
        }

        // Create transport even if bucket is null (will fail gracefully)
        transports.push(createS3Transport(s3Config, bucket));
      }
    } catch (error) {
      console.error(
        `Error creating ${transportConfig.type} transport:`,
        error
      );
      // Continue with other transports
    }
  }

  return transports;
}



















