import type { OperationDefinition, ParsedOperation } from "./types.js";
/**
 * Parse operation definition (shorthand or full config)
 */
export declare function parseOperation(operationName: string, operationDef: OperationDefinition, availableEntities?: Set<string>): ParsedOperation;
/**
 * Parse all operations from config
 */
export declare function parseOperations(operations: Record<string, OperationDefinition>, availableEntities?: Set<string>): ParsedOperation[];
//# sourceMappingURL=parser.d.ts.map