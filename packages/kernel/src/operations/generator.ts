import type { ParsedOperation } from "./types.js";
import type { SchemaField } from "../schemas.js";
import type { NormalizedEndpoint } from "../apis/index.js";

/**
 * Generate REST endpoint from parsed operation
 */
export function generateEndpointFromOperation(
  operation: ParsedOperation,
  basePath?: string
): NormalizedEndpoint {
  const fullPath = basePath 
    ? `${basePath}${operation.path}`
    : operation.path;
  
  // Extract params from path
  const params: Record<string, SchemaField> = {};
  const paramMatches = operation.path.matchAll(/\{(\w+)\}/g);
  for (const match of paramMatches) {
    const paramName = match[1];
    params[paramName] = {
      type: "string",
      required: true,
      format: paramName === "id" ? "uuid" : undefined,
    };
  }
  
  // Generate query params for list operations
  const query: Record<string, SchemaField> = {};
  if (operation.operationType === "list") {
    query.limit = { type: "number", required: false };
    query.offset = { type: "number", required: false };
  }
  
  // Generate body for create/update operations
  let body: { type?: string; fields?: Record<string, SchemaField> } | undefined;
  if (operation.operationType === "create" || operation.operationType === "update") {
    if (typeof operation.config.input === "object" && operation.config.input !== null) {
      body = { fields: operation.config.input as Record<string, SchemaField> };
    } else if (typeof operation.config.input === "string") {
      body = { type: operation.config.input };
    }
  }
  
  // Generate response
  let response: { type?: string; fields?: Record<string, SchemaField> } | undefined;
  if (operation.config.output === null) {
    // No response body (204)
    response = undefined;
  } else if (typeof operation.config.output === "string") {
    response = { type: operation.config.output };
  } else if (operation.config.output && typeof operation.config.output === "object" && "fields" in operation.config.output) {
    response = { fields: operation.config.output.fields as Record<string, SchemaField> };
  }
  
  return {
    method: operation.method,
    path: fullPath,
    handler: operation.config.handler,
    description: `${operation.operationType} ${operation.entity || operation.name}`,
    params: Object.keys(params).length > 0 ? params : undefined,
    query: Object.keys(query).length > 0 ? query : undefined,
    body,
    response,
    // Store operation name for policy/path matching
    _operationName: operation.name,
  } as NormalizedEndpoint & { _operationName?: string };
}

/**
 * Generate all endpoints from operations
 */
export function generateEndpointsFromOperations(
  operations: ParsedOperation[],
  basePath?: string
): NormalizedEndpoint[] {
  return operations.map(op => generateEndpointFromOperation(op, basePath));
}
