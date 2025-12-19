/**
 * Log levels in order of severity
 */
export enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5,
}

/**
 * Helper function to parse log level string to enum
 */
export function parseLogLevel(level: string): LogLevel {
    const normalized = level.toLowerCase();
    switch (normalized) {
        case "trace":
            return LogLevel.TRACE;
        case "debug":
            return LogLevel.DEBUG;
        case "info":
            return LogLevel.INFO;
        case "warn":
            return LogLevel.WARN;
        case "error":
            return LogLevel.ERROR;
        case "fatal":
            return LogLevel.FATAL;
        default:
            return LogLevel.INFO;
    }
}

/**
 * Helper function to get log level name
 */
export function getLogLevelName(level: LogLevel): string {
    switch (level) {
        case LogLevel.TRACE:
            return "TRACE";
        case LogLevel.DEBUG:
            return "DEBUG";
        case LogLevel.INFO:
            return "INFO";
        case LogLevel.WARN:
            return "WARN";
        case LogLevel.ERROR:
            return "ERROR";
        case LogLevel.FATAL:
            return "FATAL";
        default:
            return "INFO";
    }
}
