import type { HandlerContext } from "../infrastructure/server.js";

/**
 * Middleware lifecycle phases
 */
export type MiddlewarePhase = 
  | 'pre-auth'      // Before authentication
  | 'post-auth'     // After auth, before rate limiting
  | 'pre-handler'   // After validation, before handler
  | 'post-handler'  // After handler, before response validation
  | 'error';        // On any error

/**
 * Next function to continue middleware chain
 */
export type NextFunction = () => Promise<void>;

/**
 * Middleware handler function
 * Receives middleware context and next function
 */
export type MiddlewareHandler = (
  context: MiddlewareContext,
  next: NextFunction
) => Promise<void> | void;

/**
 * Middleware context extends HandlerContext with phase-specific information
 */
export interface MiddlewareContext extends Omit<HandlerContext, 'metrics'> {
  /**
   * Current middleware phase
   */
  phase: MiddlewarePhase;

  /**
   * Middleware control functions
   */
  middleware: {
    /**
     * Name of the current middleware
     */
    name: string;
    
    /**
     * Skip remaining middleware in this phase
     */
    skip: () => void;
    
    /**
     * Abort request and return response
     */
    abort: (response: unknown) => void;
  };

  /**
   * Optional metrics helpers (if metrics plugin is available)
   * Middleware-specific metrics interface with timer support
   */
  metrics?: {
    /**
     * Start a timer, returns a function to stop it
     */
    startTimer: (name: string, labels?: Record<string, string>) => () => void;
    
    /**
     * Increment a counter
     */
    increment: (name: string, labels?: Record<string, string>) => void;
  };
}

/**
 * Internal middleware state for execution control
 */
export interface MiddlewareState {
  skipped: boolean;
  aborted: boolean;
  abortResponse?: unknown;
}

/**
 * Middleware definition
 */
export interface MiddlewareDefinition {
  /**
   * Unique name for the middleware
   * For plugin-provided middleware, use plugin name (e.g., "@betagors/yama-metrics")
   */
  name: string;

  /**
   * Middleware handler function or file path
   * If string, it's a file path relative to project root
   */
  handler: MiddlewareHandler | string;

  /**
   * Phases this middleware should run in
   */
  phases: MiddlewarePhase[];

  /**
   * Execution priority (lower = earlier)
   * Default: 100
   */
  priority?: number;

  /**
   * Whether middleware is enabled
   * Default: true
   */
  enabled?: boolean;

  /**
   * Optional configuration for the middleware
   */
  config?: Record<string, unknown>;

  /**
   * Optional endpoint path pattern for endpoint-specific middleware
   * If not set, middleware is global
   */
  endpointPath?: string;

  /**
   * Optional HTTP method for endpoint-specific middleware
   * If not set, applies to all methods
   */
  endpointMethod?: string;
}

/**
 * Internal middleware entry with resolved handler
 */
export interface Middleware {
  name: string;
  handler: MiddlewareHandler;
  phases: MiddlewarePhase[];
  priority: number;
  enabled: boolean;
  config?: Record<string, unknown>;
  endpointPath?: string;
  endpointMethod?: string;
}



