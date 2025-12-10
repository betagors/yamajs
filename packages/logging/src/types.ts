/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log format types
 */
export type LogFormat = "json" | "text" | "pretty";

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  levelName: string;
  message: string;
  metadata?: Record<string, unknown>;
  error?: Error;
  /** Bindings from child loggers (e.g., requestId, userId) */
  bindings?: Record<string, unknown>;
}

/**
 * Base transport configuration
 */
export interface TransportConfig {
  type: "console" | "file" | "s3";
  format?: LogFormat;
  level?: string; // Override global level for this transport
}

/**
 * Console transport configuration
 */
export interface ConsoleTransportConfig extends TransportConfig {
  type: "console";
  format?: LogFormat;
  colors?: boolean; // Enable colored output for text format
}

/**
 * File rotation configuration
 */
export interface FileRotationConfig {
  enabled?: boolean;
  maxSize?: string; // e.g., "10MB", "100KB"
  maxFiles?: number; // Keep last N files
  interval?: "hourly" | "daily" | "weekly"; // Time-based rotation
}

/**
 * File transport configuration
 */
export interface FileTransportConfig extends TransportConfig {
  type: "file";
  path: string;
  format?: LogFormat;
  rotation?: FileRotationConfig;
  bufferSize?: number; // Number of logs to buffer before writing
}

/**
 * S3 transport configuration
 */
export interface S3TransportConfig extends TransportConfig {
  type: "s3";
  bucket: string; // Bucket alias from s3 plugin config
  prefix?: string; // Prefix for log files in S3
  format?: LogFormat;
  batchSize?: number; // Number of logs to batch before upload
  flushInterval?: number; // Milliseconds between automatic flushes
}

/**
 * Union type for all transport configs
 */
export type AnyTransportConfig =
  | ConsoleTransportConfig
  | FileTransportConfig
  | S3TransportConfig;

/**
 * Redaction configuration
 */
export interface RedactionConfig {
  /** Keys to redact (e.g., 'password', 'token', 'authorization') */
  keys?: string[];
  /** Paths to redact (e.g., 'user.password', 'headers.authorization') */
  paths?: string[];
  /** Replacement string (default: '[REDACTED]') */
  replacement?: string;
}

/**
 * Logging plugin configuration
 */
export interface LoggingPluginConfig {
  level?: string; // Global log level: "debug" | "info" | "warn" | "error"
  transports?: AnyTransportConfig[];
  /** Redaction config for sensitive data */
  redact?: RedactionConfig;
  /** Auto-detect pretty format in development (default: true) */
  autoPretty?: boolean;
  /** 
   * Logging groups for per-feature verbosity control
   * Example: { database: 'debug', auth: 'warn', 'yama:http': 'info' }
   */
  groups?: Record<string, 'debug' | 'info' | 'warn' | 'error' | 'off'>;
}

/**
 * Transport interface that all transports must implement
 */
export interface Transport {
  /**
   * Write a log entry
   */
  write(entry: LogEntry): Promise<void> | void;

  /**
   * Flush any buffered logs
   */
  flush?(): Promise<void> | void;

  /**
   * Close the transport and cleanup resources
   */
  close?(): Promise<void> | void;
}

/**
 * Helper function to parse log level string to enum
 */
export function parseLogLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();
  switch (normalized) {
    case "debug":
      return LogLevel.DEBUG;
    case "info":
      return LogLevel.INFO;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Helper function to get log level name
 */
export function getLogLevelName(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return "DEBUG";
    case LogLevel.INFO:
      return "INFO";
    case LogLevel.WARN:
      return "WARN";
    case LogLevel.ERROR:
      return "ERROR";
  }
}



















