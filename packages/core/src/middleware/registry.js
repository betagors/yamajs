/**
 * Middleware registry manages middleware registration and execution
 */
export class MiddlewareRegistry {
    constructor() {
        this.middleware = [];
        this.endpointMiddleware = new Map();
    }
    /**
     * Register middleware
     */
    register(definition) {
        // Resolve handler if it's a file path
        const handler = typeof definition.handler === 'string'
            ? definition.handler // Will be resolved later by loader
            : definition.handler;
        const middleware = {
            name: definition.name,
            handler,
            phases: definition.phases,
            priority: definition.priority ?? 100,
            enabled: definition.enabled !== false,
            config: definition.config,
            endpointPath: definition.endpointPath,
            endpointMethod: definition.endpointMethod,
        };
        if (middleware.endpointPath) {
            // Endpoint-specific middleware
            const key = this.getEndpointKey(middleware.endpointPath, middleware.endpointMethod);
            if (!this.endpointMiddleware.has(key)) {
                this.endpointMiddleware.set(key, []);
            }
            this.endpointMiddleware.get(key).push(middleware);
        }
        else {
            // Global middleware
            this.middleware.push(middleware);
        }
        // Sort by priority (lower = earlier)
        this.middleware.sort((a, b) => a.priority - b.priority);
        for (const middlewares of this.endpointMiddleware.values()) {
            middlewares.sort((a, b) => a.priority - b.priority);
        }
    }
    /**
     * Get middleware for a specific phase and optionally endpoint
     */
    getMiddlewareForPhase(phase, endpointPath, endpointMethod) {
        const result = [];
        // Add global middleware for this phase
        for (const mw of this.middleware) {
            if (mw.enabled && mw.phases.includes(phase)) {
                result.push(mw);
            }
        }
        // Add endpoint-specific middleware if endpoint matches
        if (endpointPath) {
            const key = this.getEndpointKey(endpointPath, endpointMethod);
            const endpointMw = this.endpointMiddleware.get(key);
            if (endpointMw) {
                for (const mw of endpointMw) {
                    if (mw.enabled && mw.phases.includes(phase)) {
                        result.push(mw);
                    }
                }
            }
            // Also check for path pattern matches (e.g., "/api/*")
            for (const [patternKey, middlewares] of this.endpointMiddleware.entries()) {
                if (patternKey !== key && this.matchesPattern(endpointPath, patternKey)) {
                    for (const mw of middlewares) {
                        if (mw.enabled && mw.phases.includes(phase)) {
                            // Check method match if specified
                            if (!mw.endpointMethod || mw.endpointMethod === endpointMethod) {
                                result.push(mw);
                            }
                        }
                    }
                }
            }
        }
        // Sort by priority
        result.sort((a, b) => a.priority - b.priority);
        return result;
    }
    /**
     * Execute middleware for a specific phase
     */
    async executePhase(phase, context, endpointPath, endpointMethod) {
        const middleware = this.getMiddlewareForPhase(phase, endpointPath, endpointMethod);
        if (middleware.length === 0) {
            return;
        }
        const state = {
            skipped: false,
            aborted: false,
        };
        let index = 0;
        const next = async () => {
            if (state.aborted || state.skipped) {
                return;
            }
            if (index >= middleware.length) {
                return;
            }
            const mw = middleware[index++];
            // Update middleware name in context
            context.middleware.name = mw.name;
            try {
                await mw.handler(context, next);
            }
            catch (error) {
                // If error occurs in middleware, propagate it
                // Error phase middleware will handle it
                throw error;
            }
        };
        await next();
    }
    /**
     * Clear all registered middleware
     */
    clear() {
        this.middleware = [];
        this.endpointMiddleware.clear();
    }
    /**
     * Get endpoint key for endpoint-specific middleware lookup
     */
    getEndpointKey(path, method) {
        return method ? `${method}:${path}` : path;
    }
    /**
     * Check if endpoint path matches a pattern (supports wildcards)
     */
    matchesPattern(path, pattern) {
        // Simple wildcard matching: "/*" matches everything after
        if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -2);
            return path.startsWith(prefix);
        }
        // Exact match
        return path === pattern;
    }
    /**
     * Get all registered middleware (for debugging/inspection)
     */
    getAllMiddleware() {
        return [...this.middleware];
    }
    /**
     * Get endpoint-specific middleware (for debugging/inspection)
     */
    getEndpointMiddleware() {
        return new Map(this.endpointMiddleware);
    }
}
//# sourceMappingURL=registry.js.map