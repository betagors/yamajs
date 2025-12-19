import type { LogLevel } from "../../../../../../../../../../core/logging/src/levels.js";

/**
 * The core event model for all logs in Yama.
 * This structure is enforced across all child loggers and transports.
 */
export interface LogEvent {
    /** RFC3339 timestamp */
    timestamp: string;

    /** Numeric level for filtering */
    level: LogLevel;

    /** String level for display */
    levelName: string;

    /** The log message */
    message: string;

    /** 
     * Contextual metadata. 
     * Can include requestId, userId, service name, etc.
     */
    metadata?: Record<string, any>;

    /** Error object if applicable */
    error?: {
        name: string;
        message: string;
        stack?: string;
        code?: string;
        [key: string]: any;
    };

    /** Specific scope (e.g. 'user', 'system', 'kernel') */
    scope?: string;
}
