import type {
  MiddlewarePhase,
  MiddlewareDefinition,
  Middleware,
  MiddlewareContext,
  MiddlewareState,
} from "./types.js";

/**
 * Middleware registry manages middleware registration and execution
 */
export class MiddlewareRegistry {
  private middleware: Middleware[] = [];
  private endpointMiddleware: Map<string, Middleware[]> = new Map();

  /**
   * Register middleware
   */
  register(definition: MiddlewareDefinition): void {
    // Resolve handler if it's a file path
    const handler: Middleware['handler'] = typeof definition.handler === 'string'
      ? definition.handler as any // Will be resolved later by loader
      : definition.handler;

    const middleware: Middleware = {
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
      this.endpointMiddleware.get(key)!.push(middleware);
    } else {
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
  getMiddlewareForPhase(
    phase: MiddlewarePhase,
    endpointPath?: string,
    endpointMethod?: string
  ): Middleware[] {
    const result: Middleware[] = [];

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
  async executePhase(
    phase: MiddlewarePhase,
    context: MiddlewareContext,
    endpointPath?: string,
    endpointMethod?: string
  ): Promise<void> {
    const middleware = this.getMiddlewareForPhase(phase, endpointPath, endpointMethod);

    if (middleware.length === 0) {
      return;
    }

    const state: MiddlewareState = {
      skipped: false,
      aborted: false,
    };

    let index = 0;

    const next: () => Promise<void> = async () => {
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
      } catch (error) {
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
  clear(): void {
    this.middleware = [];
    this.endpointMiddleware.clear();
  }

  /**
   * Get endpoint key for endpoint-specific middleware lookup
   */
  private getEndpointKey(path: string, method?: string): string {
    return method ? `${method}:${path}` : path;
  }

  /**
   * Check if endpoint path matches a pattern (supports wildcards)
   */
  private matchesPattern(path: string, pattern: string): boolean {
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
  getAllMiddleware(): Middleware[] {
    return [...this.middleware];
  }

  /**
   * Get endpoint-specific middleware (for debugging/inspection)
   */
  getEndpointMiddleware(): Map<string, Middleware[]> {
    return new Map(this.endpointMiddleware);
  }
}



















