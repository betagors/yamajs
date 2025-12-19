// Types
export type {
  OperationDefinition,
  OperationYamlDefinition,
  OperationConfig,
  ParsedOperation,
  YamaOperations,
  OperationResult,
  OperationContext,
  OperationHandler,
  OperationType,
} from "../../../../../../../../../../../core/kernel/src/operations/types.js";

// Parser
export {
  parseOperation,
  parseOperations,
} from "../../../../../../../../../../../core/kernel/src/operations/parser.js";

// Inference
export {
  extractEntityName,
  inferMethodFromName,
  inferPathFromName,
  inferOperationType,
} from "../../../../../../../../../../../core/kernel/src/operations/inference.js";

// Generator
export {
  generateEndpointFromOperation,
  generateEndpointsFromOperations,
} from "../../../../../../../../../../../core/kernel/src/operations/generator.js";
