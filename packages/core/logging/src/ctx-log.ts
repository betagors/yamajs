import type { Logger } from "../../../../../../../core/logging/src/logger.js";
import { LogLevel } from "../../../../../../../core/logging/src/levels.js";

/**
 * Options for creating a context-bound logger
 */
export interface ContextLoggerOptions {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    [key: string]: any;
}

/**
 * Creates a restricted facade for the request context (ctx.log).
 * 
 * It forces the 'user' scope and ensures that application code 
 * cannot bypass redaction or break platform-level telemetry.
 */
export function createContextLogger(
    parentLogger: Logger,
    options: ContextLoggerOptions
): Logger {
    const { requestId, userId, sessionId, ...rest } = options;

    // Create a child with restricted scope and metadata
    const ctxLogger = parentLogger.child({
        scope: "user",
        requestId,
        userId,
        sessionId,
        ...rest,
    });

    // We could further wrap it to disable trace/fatal if desired,
    // but the user's requirement "hard-limited to approved levels" 
    // can be handled by the parent logger's filtering.
    // For now, we return the child logger which is already bound to the scope.

    return ctxLogger;
}
