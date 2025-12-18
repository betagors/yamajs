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
} from "./types.js";

// Parser
export {
  parseOperation,
  parseOperations,
} from "./parser.js";

// Inference
export {
  extractEntityName,
  inferMethodFromName,
  inferPathFromName,
  inferOperationType,
} from "./inference.js";

// Generator
export {
  generateEndpointFromOperation,
  generateEndpointsFromOperations,
} from "./generator.js";
