/**
 * Logging Middleware for Yama
 * 
 * Provides request-scoped logging with automatic requestId binding.
 */

import type { Logger } from "./logger.js";

/**
 * Handler context interface (minimal for middleware)
 */
interface HandlerContextLike {
    requestId?: string;
    logger?: {
        info(message: string, meta?: Record<string, unknown>): void;
        warn(message: string, meta?: Record<string, unknown>): void;
        error(message: string, error?: Error, meta?: Record<string, unknown>): void;
        debug(message: string, meta?: Record<string, unknown>): void;
        child?(bindings: Record<string, unknown>): HandlerContextLike['logger'];
    };
    auth?: {
        userId?: string;
    };
}

/**
 * Logging middleware options
 */
export interface LoggingMiddlewareOptions {
    /** Include userId in bindings if available (default: true) */
    includeUser?: boolean;
    /** Additional static bindings to include */
    bindings?: Record<string, unknown>;
    /** Log request start (default: true) */
    logStart?: boolean;
    /** Log request end (default: true) */
    logEnd?: boolean;
}

/**
 * Create logging middleware that auto-binds requestId to ctx.logger
 * 
 * @example
 * ```typescript
 * const loggingMiddleware = createLoggingMiddleware(logger);
 * app.use(loggingMiddleware);
 * 
 * // In handler:
 * ctx.logger?.info('User action'); // Automatically includes requestId
 * ```
 */
export function createLoggingMiddleware(
    logger: Logger,
    options: LoggingMiddlewareOptions = {}
): (ctx: HandlerContextLike, next: () => Promise<unknown>) => Promise<unknown> {
    const {
        includeUser = true,
        bindings = {},
        logStart = true,
        logEnd = true,
    } = options;

    return async (ctx: HandlerContextLike, next: () => Promise<unknown>) => {
        const startTime = Date.now();

        // Build bindings for request-scoped logger
        const requestBindings: Record<string, unknown> = {
            ...bindings,
            requestId: ctx.requestId,
        };

        // Include userId if available and enabled
        if (includeUser && ctx.auth?.userId) {
            requestBindings.userId = ctx.auth.userId;
        }

        // Create child logger with request bindings
        ctx.logger = logger.child(requestBindings) as HandlerContextLike['logger'];

        // Log request start
        if (logStart && ctx.logger) {
            ctx.logger.debug('Request started');
        }

        try {
            const result = await next();

            // Log request end
            if (logEnd && ctx.logger) {
                const duration = Date.now() - startTime;
                ctx.logger.debug('Request completed', { durationMs: duration });
            }

            return result;
        } catch (error) {
            // Log error
            if (ctx.logger) {
                const duration = Date.now() - startTime;
                ctx.logger.error('Request failed', error as Error, { durationMs: duration });
            }
            throw error;
        }
    };
}

/**
 * Create a simple logger adapter for HandlerContext
 * Converts a Logger instance to the HandlerContext logger interface
 */
export function createContextLogger(
    logger: Logger
): HandlerContextLike['logger'] {
    return {
        info: (message, meta) => logger.info(message, meta),
        warn: (message, meta) => logger.warn(message, meta),
        error: (message, error, meta) => logger.error(message, error, meta),
        debug: (message, meta) => logger.debug(message, meta),
        child: (bindings) => createContextLogger(logger.child(bindings)),
    };
}
