import type { MiddlewarePhase, MiddlewareDefinition, Middleware, MiddlewareContext } from "./types.js";
/**
 * Middleware registry manages middleware registration and execution
 */
export declare class MiddlewareRegistry {
    private middleware;
    private endpointMiddleware;
    /**
     * Register middleware
     */
    register(definition: MiddlewareDefinition): void;
    /**
     * Get middleware for a specific phase and optionally endpoint
     */
    getMiddlewareForPhase(phase: MiddlewarePhase, endpointPath?: string, endpointMethod?: string): Middleware[];
    /**
     * Execute middleware for a specific phase
     */
    executePhase(phase: MiddlewarePhase, context: MiddlewareContext, endpointPath?: string, endpointMethod?: string): Promise<void>;
    /**
     * Clear all registered middleware
     */
    clear(): void;
    /**
     * Get endpoint key for endpoint-specific middleware lookup
     */
    private getEndpointKey;
    /**
     * Check if endpoint path matches a pattern (supports wildcards)
     */
    private matchesPattern;
    /**
     * Get all registered middleware (for debugging/inspection)
     */
    getAllMiddleware(): Middleware[];
    /**
     * Get endpoint-specific middleware (for debugging/inspection)
     */
    getEndpointMiddleware(): Map<string, Middleware[]>;
}
