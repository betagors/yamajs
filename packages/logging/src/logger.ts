import { LogLevel, getLogLevelName, parseLogLevel } from "./levels.js";
import type { LogEvent } from "./event.js";
import { redact, type RedactionConfig } from "./redact.js";

/**
 * Transport interface that all logging adapters must implement.
 */
export interface Transport {
  /** Write a log event to the destination */
  write(event: LogEvent): Promise<void> | void;
  /** Optional flush for buffered transports */
  flush?(): Promise<void> | void;
  /** Optional close for cleanup */
  close?(): Promise<void> | void;
}

export interface LoggerConfig {
  /** Global log level */
  level?: LogLevel | string;
  /** Redaction configuration */
  redact?: RedactionConfig;
  /** Transports to fan-out to */
  transports?: Transport[];
}

/**
 * Core Logger Service.
 * 
 * Enforces:
 * - Deterministic event shape (LogEvent)
 * - Platform invariants (Levels, Scoping, Redaction)
 * - Fan-out to multiple transports
 */
export class Logger {
  private level: LogLevel;
  private transports: Transport[];
  private redactConfig?: RedactionConfig;
  private bindings: Record<string, any>;

  constructor(config: LoggerConfig = {}, bindings: Record<string, any> = {}) {
    this.level = typeof config.level === "string"
      ? parseLogLevel(config.level)
      : config.level ?? LogLevel.INFO;

    this.transports = config.transports ?? [];
    this.redactConfig = config.redact;
    this.bindings = bindings;
  }

  /**
   * Create a scoped child logger.
   * Bound context is immutable for this child.
   */
  child(bindings: Record<string, any>): Logger {
    return new Logger(
      {
        level: this.level,
        transports: this.transports,
        redact: this.redactConfig,
      },
      { ...this.bindings, ...bindings }
    );
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  setLevel(level: LogLevel | string): void {
    this.level = typeof level === "string" ? parseLogLevel(level) : level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Internal logging engine
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: any): void {
    if (level < this.level) {
      return;
    }

    // Enforce Event Model
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      levelName: getLogLevelName(level),
      message,
      metadata: metadata ? redact({ ...this.bindings, ...metadata }, this.redactConfig) : this.bindings,
      scope: this.bindings.scope,
    };

    if (error) {
      event.error = {
        name: error.name || "Error",
        message: error.message || String(error),
        stack: error.stack,
        code: error.code,
        ...redact(error, this.redactConfig), // Capture extra fields safely
      };
    }

    // Fan-out to transports
    for (const transport of this.transports) {
      try {
        const result = transport.write(event);
        if (result instanceof Promise) {
          result.catch((err) => {
            // Last resort fallback - we can't log transport failures to the same transports
            console.error(`[Logging] Transport write failure: ${err.message}`);
          });
        }
      } catch (err: any) {
        console.error(`[Logging] Transport write failure: ${err.message}`);
      }
    }
  }

  trace(msg: string, meta?: Record<string, any>): void { this.log(LogLevel.TRACE, msg, meta); }
  debug(msg: string, meta?: Record<string, any>): void { this.log(LogLevel.DEBUG, msg, meta); }
  info(msg: string, meta?: Record<string, any>): void { this.log(LogLevel.INFO, msg, meta); }
  warn(msg: string, meta?: Record<string, any>): void { this.log(LogLevel.WARN, msg, meta); }
  error(msg: string, err?: any, meta?: Record<string, any>): void { this.log(LogLevel.ERROR, msg, meta, err); }
  fatal(msg: string, err?: any, meta?: Record<string, any>): void { this.log(LogLevel.FATAL, msg, meta, err); }

  async flush(): Promise<void> {
    await Promise.allSettled(
      this.transports.map((t) => (t.flush ? t.flush() : Promise.resolve()))
    );
  }

  async close(): Promise<void> {
    await Promise.allSettled(
      this.transports.map((t) => (t.close ? t.close() : Promise.resolve()))
    );
  }
}
