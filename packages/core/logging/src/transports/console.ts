import type { Transport } from "../../../../../../../../../../../core/logging/src/logger.js";
import type { LogEvent } from "../../../../../../../../../../../core/logging/src/event.js";
import { LogLevel } from "../../../../../../../../../../../core/logging/src/levels.js";
import { formatLogEntry, type LogFormat } from "../../../../../../../../../../../core/logging/src/formatters.js";

export interface ConsoleTransportConfig {
  format?: LogFormat;
}

/**
 * Standard Console Transport.
 * Part of Yama Core Logging.
 */
export class ConsoleTransport implements Transport {
  private format: LogFormat;

  constructor(config: ConsoleTransportConfig = {}) {
    this.format = config.format || "pretty";
  }

  write(event: LogEvent): void {
    const formatted = formatLogEntry(event, this.format);

    switch (event.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
}

export function createConsoleTransport(config?: ConsoleTransportConfig): ConsoleTransport {
  return new ConsoleTransport(config);
}
