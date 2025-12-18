
import {
    OperationDefinition,
    OperationContext,
    OperationResult,
    YamaError,
    OperationHandler
} from './types.js';
import { operationRegistry } from './registry.js';

/**
 * Executes a named operation through the standard pipeline.
 * Use this method from Transporters.
 */
export async function executeOperation<TInput = any, TOutput = any>(
    name: string,
    input: TInput,
    ctx: OperationContext
): Promise<OperationResult<TOutput> | AsyncIterable<TOutput>> {

    // 1. Lookup
    const op = operationRegistry.get(name);
    if (!op) {
        return createErrorResult({
            code: 'OPERATION_NOT_FOUND',
            message: `Operation ${name} not found`,
            status: 404
        });
    }

    // 2. Auth Check (Placeholder for real auth pipeline)
    // if (op.auth?.enabled && !ctx.user) ...

    // 3. Validation (Placeholder for Zod/Schema validation)
    // const validInput = validate(op.input, input);

    try {
        // 4. Execution
        const result = isAsyncIterableHandler(op.handler)
            ? op.handler(ctx, input) // Streaming result, return as is (Transporter handles iterators)
            : await op.handler(ctx, input);

        // 5. Output Normalization
        if (isAsyncIterable(result)) {
            // Streaming operations don't get wrapped in OperationResult envelope per-chunk usually,
            // or the stream yields OperationResult items. 
            // For Yama v1, we assume Subscriptions yield raw data or events.
            // But let's verify type safety.
            return result as AsyncIterable<TOutput>;
        }

        // Standard Request/Response
        return {
            success: true,
            data: result as TOutput,
            meta: {
                traceId: ctx.requestId
            }
        };

    } catch (err: any) {
        // 6. Error Handling
        console.error(`[Operation: ${name}] Execution Failed:`, err);
        return createErrorResult({
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'An unexpected error occurred',
            details: err.details,
            status: err.status || 500
        });
    }
}

/**
 * Helper to construct standardized error envelopes
 */
export function createErrorResult(error: YamaError): OperationResult<any> {
    return {
        success: false,
        error,
        meta: {
            // timestamp: Date.now()
        }
    };
}

// Type guard for streams
function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
    return obj && typeof obj[Symbol.asyncIterator] === 'function';
}

function isAsyncIterableHandler(fn: Function): boolean {
    // We can't actually check return type at runtime easily without calling it.
    // So we just call it and check the result in the try block.
    return false;
}
