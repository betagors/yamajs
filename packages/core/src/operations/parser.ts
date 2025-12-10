import type { OperationDefinition, OperationConfig, ParsedOperation } from "./types.js";
import { inferMethodFromName, inferPathFromName, inferOperationType, extractEntityName } from "./inference.js";
import { parseSchemaFieldDefinition } from "../schemas.js";

/**
 * Parse operation definition (shorthand or full config)
 */
export function parseOperation(
  operationName: string,
  operationDef: OperationDefinition,
  availableEntities?: Set<string>
): ParsedOperation {
  // Handle shorthand: string = output schema name, null = no response body
  let config: OperationConfig;
  if (typeof operationDef === "string") {
    config = {
      output: operationDef,
    };
  } else if (operationDef === null) {
    // Shorthand for no response body (204)
    config = {
      output: null,
    };
  } else {
    config = operationDef;
  }
  
  // Infer entity name
  const entityName = extractEntityName(operationName);
  
  // Infer method and path
  const method = inferMethodFromName(operationName);
  const path = config.path || inferPathFromName(
    operationName,
    entityName,
    config.parent
  );
  
  // Infer operation type
  const operationType = inferOperationType(operationName);
  
  // Auto-generate input if not specified
  if (!config.input) {
    if (operationType === "get" || operationType === "delete") {
      // Standard get-by-id or delete-by-id input
      config.input = {
        id: { type: "uuid", required: true },
      };
    } else if (operationType === "list") {
      // List operations get pagination params
      config.input = {
        limit: { type: "number", required: false },
        offset: { type: "number", required: false },
      };
    }
    // create/update operations need entity fields - will be inferred from entity if available
    // For now, leave undefined and let the generator handle it
  } else if (config.input === "id") {
    // Standard get-by-id input
    config.input = {
      id: { type: "uuid", required: true },
    };
  } else if (typeof config.input === "string" && config.input !== "id") {
    // Schema reference - will be resolved later
    // Keep as-is for now
  } else if (config.input && typeof config.input === "object") {
    // Parse field definitions
    const parsedInput: Record<string, any> = {};
    for (const [fieldName, fieldDef] of Object.entries(config.input)) {
      if (typeof fieldDef === "string") {
        parsedInput[fieldName] = parseSchemaFieldDefinition(fieldName, fieldDef);
      } else {
        parsedInput[fieldName] = fieldDef;
      }
    }
    config.input = parsedInput;
  }
  
  // Add parentId param for nested operations (after input is normalized)
  if (config.parent && config.input && typeof config.input === "object") {
    const parentIdParam = `${config.parent.charAt(0).toLowerCase() + config.parent.slice(1)}Id`;
    if (!(parentIdParam in config.input)) {
      config.input[parentIdParam] = { type: "uuid", required: true };
    }
  }
  
  // Normalize output if it's an object with fields
  if (config.output && typeof config.output === "object" && "fields" in config.output) {
    const parsedOutput: Record<string, any> = {};
    for (const [fieldName, fieldDef] of Object.entries(config.output.fields)) {
      if (typeof fieldDef === "string") {
        parsedOutput[fieldName] = parseSchemaFieldDefinition(fieldName, fieldDef);
      } else {
        parsedOutput[fieldName] = fieldDef;
      }
    }
    config.output = { fields: parsedOutput };
  }
  
  return {
    name: operationName,
    config,
    method,
    path,
    entity: entityName,
    operationType,
  };
}

/**
 * Parse all operations from config
 */
export function parseOperations(
  operations: Record<string, OperationDefinition>,
  availableEntities?: Set<string>
): ParsedOperation[] {
  const parsed: ParsedOperation[] = [];
  
  for (const [operationName, operationDef] of Object.entries(operations)) {
    parsed.push(parseOperation(operationName, operationDef, availableEntities));
  }
  
  return parsed;
}
