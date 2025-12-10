/**
 * Middleware execution utilities for YAMA Node Runtime
 * 
 * This module handles middleware execution across different phases
 * of the request lifecycle.
 */

import type {
  HandlerContext,
  MiddlewarePhase,
  MiddlewareContext,
  MiddlewareRegistry,
} from "@betagors/yama-core";

/**
 * Execute middleware phase with proper context
 * 
 * Runs all middleware registered for a specific phase (pre-auth, post-auth,
 * pre-handler, post-handler, error) in priority order.
 * 
 * Middleware can:
 * - Skip remaining middleware in the phase (middleware.skip())
 * - Abort request with custom response (middleware.abort(response))
 * - Throw errors to trigger error phase
 * 
 * @param middlewareRegistry - Registry containing all middleware
 * @param phase - Lifecycle phase to execute
 * @param handlerContext - Current request context
 * @param path - Request path for endpoint-specific middleware
 * @param method - HTTP method for endpoint-specific middleware
 * @returns Execution result indicating if request was aborted
 * 
 * @remarks
 * - Global middleware runs for all endpoints
 * - Endpoint-specific middleware runs only for matching path/method
 * - Middleware executes in priority order (higher priority first)
 * - Aborted requests short-circuit remaining middleware and handler
 * 
 * @example
 * ```typescript
 * // Execute pre-auth middleware
 * const result = await executeMiddlewarePhase(
 *   registry,
 *   'pre-auth',
 *   context,
 *   '/users',
 *   'GET'
 * );
 * 
 * if (result.aborted) {
 *   // Middleware aborted request, send abort response
 *   reply.status(200).send(result.abortResponse);
 *   return;
 * }
 * ```
 */
export async function executeMiddlewarePhase(
  middlewareRegistry: MiddlewareRegistry | undefined,
  phase: MiddlewarePhase,
  handlerContext: HandlerContext,
  path: string,
  method: string
): Promise<{ aborted: boolean; abortResponse?: unknown }> {
  if (!middlewareRegistry) {
    return { aborted: false };
  }

  // State shared across middleware execution
  const state = {
    skipped: false,
    aborted: false,
    abortResponse: undefined as unknown,
  };

  // Create middleware-compatible metrics adapter
  // Converts handler context metrics to middleware context format
  const middlewareMetrics = handlerContext.metrics ? {
    startTimer: (name: string, labels?: Record<string, string>) => {
      const startTime = Date.now();
      return () => {
        const duration = Date.now() - startTime;
        handlerContext.metrics!.histogram(name, duration, labels);
      };
    },
    increment: (name: string, labels?: Record<string, string>) => {
      handlerContext.metrics!.increment(name, 1, labels);
    },
  } : undefined;

  // Build middleware context from handler context
  const middlewareContext: MiddlewareContext = {
    ...handlerContext,
    phase,
    middleware: {
      name: '',
      skip: () => {
        state.skipped = true;
      },
      abort: (response: unknown) => {
        state.aborted = true;
        state.abortResponse = response;
      },
    },
    metrics: middlewareMetrics,
  };

  try {
    await middlewareRegistry.executePhase(phase, middlewareContext, path, method);
  } catch (error) {
    // Re-throw to be handled by error phase
    throw error;
  }

  return {
    aborted: state.aborted,
    abortResponse: state.abortResponse,
  };
}
