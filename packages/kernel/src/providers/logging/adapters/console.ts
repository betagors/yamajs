/**
 * Logging Provider - Console Adapter
 * 
 * Provides structured logging with pretty (dev) and JSON (prod) formats.
 * Zero external dependencies - uses built-in console.
 * 
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Pretty format with colors (development)
 * - JSON format for structured logging (production)
 * - Child loggers with bound context
 * - Automatic format detection based on NODE_ENV
 */

import type {
    Provider,
    ProviderContext,
    LoggingProviderConfig,
    LoggerAPI,
    LogLevel,
} from '../../types.js';
import { registerAdapter } from '../../registry.js';

// ============================================================================
// Console Colors
// ============================================================================

const COLORS = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: COLORS.gray,
    info: COLORS.cyan,
    warn: COLORS.yellow,
    error: COLORS.red,
};

const LEVEL_ICONS: Record<LogLevel, string> = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format timestamp for logs
 */
function formatTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Format metadata object for pretty printing
 */
function formatMetaPretty(meta: Record<string, unknown>, colors: boolean): string {
    if (Object.keys(meta).length === 0) return '';

    const entries = Object.entries(meta).map(([key, value]) => {
        const formattedValue = typeof value === 'string' ? value : JSON.stringify(value);
        if (colors) {
            return `${COLORS.dim}${key}=${COLORS.reset}${formattedValue}`;
        }
        return `${key}=${formattedValue}`;
    });

    return entries.join(' ');
}

/**
 * Format a log entry in pretty format
 */
function formatPretty(
    level: LogLevel,
    message: string,
    meta: Record<string, unknown>,
    options: { timestamp: boolean; colors: boolean }
): string {
    const parts: string[] = [];

    // Timestamp
    if (options.timestamp) {
        if (options.colors) {
            parts.push(`${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
        } else {
            parts.push(formatTimestamp());
        }
    }

    // Level with icon and color
    const levelStr = level.toUpperCase().padEnd(5);
    if (options.colors) {
        parts.push(`${LEVEL_COLORS[level]}${LEVEL_ICONS[level]} ${levelStr}${COLORS.reset}`);
    } else {
        parts.push(levelStr);
    }

    // Message
    parts.push(message);

    // Metadata
    const metaStr = formatMetaPretty(meta, options.colors);
    if (metaStr) {
        parts.push(metaStr);
    }

    return parts.join(' ');
}

/**
 * Format a log entry in JSON format
 */
function formatJSON(
    level: LogLevel,
    message: string,
    meta: Record<string, unknown>,
    options: { timestamp: boolean }
): string {
    const entry: Record<string, unknown> = {
        level,
        message,
        ...meta,
    };

    if (options.timestamp) {
        entry.timestamp = formatTimestamp();
    }

    return JSON.stringify(entry);
}

// ============================================================================
// Console Logger Implementation
// ============================================================================

interface LoggerOptions {
    level: LogLevel;
    format: 'pretty' | 'json';
    timestamp: boolean;
    colors: boolean;
    bindings: Record<string, unknown>;
}

class ConsoleLogger implements LoggerAPI {
    private options: LoggerOptions;

    constructor(options: LoggerOptions) {
        this.options = options;
    }

    get level(): LogLevel {
        return this.options.level;
    }

    get isDebugEnabled(): boolean {
        return LEVEL_PRIORITY[this.options.level] <= LEVEL_PRIORITY.debug;
    }

    private shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.options.level];
    }

    private log(level: LogLevel, message: string, inputMeta?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        // Merge bindings with input meta
        const meta = { ...this.options.bindings, ...inputMeta };

        // Format the log entry
        const formatted = this.options.format === 'json'
            ? formatJSON(level, message, meta, { timestamp: this.options.timestamp })
            : formatPretty(level, message, meta, {
                timestamp: this.options.timestamp,
                colors: this.options.colors,
            });

        // Output to console
        switch (level) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            default:
                console.log(formatted);
        }
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        this.log('debug', message, meta);
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.log('info', message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.log('warn', message, meta);
    }

    error(message: string, meta?: Record<string, unknown>): void {
        this.log('error', message, meta);
    }

    child(bindings: Record<string, unknown>): LoggerAPI {
        return new ConsoleLogger({
            ...this.options,
            bindings: { ...this.options.bindings, ...bindings },
        });
    }
}

// ============================================================================
// Console Logging Provider
// ============================================================================

class ConsoleLoggingProvider implements Provider<LoggingProviderConfig, LoggerAPI> {
    readonly type = 'logging' as const;
    readonly adapter = 'console';
    readonly version = '1.0.0';

    private logger: LoggerAPI | null = null;

    async init(config: LoggingProviderConfig, context: ProviderContext): Promise<LoggerAPI> {
        // Determine log level
        const level: LogLevel = config.level ||
            (context.getConfig<string>('LOG_LEVEL') as LogLevel) ||
            (context.isProd ? 'info' : 'debug');

        // Determine format (auto-detect based on environment)
        const format: 'pretty' | 'json' = config.format ||
            (context.isProd ? 'json' : 'pretty');

        // Determine if colors should be used
        // Default: true for pretty format in TTY, false otherwise
        const isTTY = process.stdout.isTTY ?? false;
        const colors = config.colors ?? (format === 'pretty' && isTTY && !context.isProd);

        // Timestamp default
        const timestamp = config.timestamp ?? true;

        // Create logger
        this.logger = new ConsoleLogger({
            level,
            format,
            timestamp,
            colors,
            bindings: {},
        });

        context.log.debug('Console logging provider configured', {
            level,
            format,
            timestamp,
            colors,
        });

        return this.logger;
    }

    getAPI(): LoggerAPI {
        if (!this.logger) {
            throw new Error('Logging provider not initialized. Call init() first.');
        }
        return this.logger;
    }

    isInitialized(): boolean {
        return this.logger !== null;
    }

    async healthCheck() {
        return {
            healthy: true,
            details: {
                level: this.logger instanceof ConsoleLogger
                    ? (this.logger as ConsoleLogger).level
                    : 'unknown',
            },
        };
    }

    // No shutdown needed for logging provider
}

// ============================================================================
// Register Adapter
// ============================================================================

registerAdapter('logging', 'console', () => new ConsoleLoggingProvider());

// ============================================================================
// Exports
// ============================================================================

export { ConsoleLoggingProvider, ConsoleLogger };
export { formatPretty, formatJSON };
