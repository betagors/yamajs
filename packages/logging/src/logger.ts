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

  constructor(config: LoggingPluginConfig) {
    this.config = config;
    this.level = parseLogLevel(config.level || "info");
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
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevelEnum): boolean {
    return level >= this.level;
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
    return {
      timestamp: new Date(),
      level,
      levelName: getLogLevelName(level),
      message,
      metadata,
      error,
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
 * Create transports from configuration
 */
export async function createTransports(
  config: LoggingPluginConfig,
  context?: {
    getPluginAPI?: (name: string) => any;
  }
): Promise<Transport[]> {
  const transports: Transport[] = [];

  if (!config.transports || config.transports.length === 0) {
    // Default to console transport if none specified
    transports.push(createConsoleTransport({ type: "console", format: "text" }));
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
















