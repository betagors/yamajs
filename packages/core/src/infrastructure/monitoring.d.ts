import type { HttpRequest, HttpResponse, HandlerContext } from "./server.js";
/**
 * Context for error tracking
 */
export interface ErrorContext {
    request?: {
        method: string;
        path: string;
        query?: Record<string, unknown>;
        params?: Record<string, unknown>;
        headers?: Record<string, string | undefined>;
    };
    user?: {
        id?: string;
        email?: string;
        [key: string]: unknown;
    };
    context?: HandlerContext;
    metadata?: Record<string, unknown>;
}
/**
 * Monitoring hooks interface that plugins can implement
 * Plugins register as "monitoring" service to receive these hooks
 */
export interface MonitoringHooks {
    /**
     * Called when a request starts
     */
    onRequestStart?(req: HttpRequest, context: HandlerContext): void;
    /**
     * Called when a request completes successfully
     */
    onRequestEnd?(req: HttpRequest, res: HttpResponse, duration: number, context: HandlerContext): void;
    /**
     * Called when an error occurs during request processing
     */
    onError?(error: Error, errorContext: ErrorContext): void;
}
/**
 * Monitoring service interface
 * Plugins that implement monitoring should implement this interface
 * and register themselves as "monitoring" service
 */
export interface MonitoringService extends MonitoringHooks {
    /**
     * Service name for identification
     */
    readonly name: string;
}
