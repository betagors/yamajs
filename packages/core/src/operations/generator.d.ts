import type { ParsedOperation } from "./types.js";
import type { NormalizedEndpoint } from "../apis/index.js";
/**
 * Generate REST endpoint from parsed operation
 */
export declare function generateEndpointFromOperation(operation: ParsedOperation, basePath?: string): NormalizedEndpoint;
/**
 * Generate all endpoints from operations
 */
export declare function generateEndpointsFromOperations(operations: ParsedOperation[], basePath?: string): NormalizedEndpoint[];
//# sourceMappingURL=generator.d.ts.map