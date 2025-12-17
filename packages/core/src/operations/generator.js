/**
 * Generate REST endpoint from parsed operation
 */
export function generateEndpointFromOperation(operation, basePath) {
    const fullPath = basePath
        ? `${basePath}${operation.path}`
        : operation.path;
    // Extract params from path
    const params = {};
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
    const query = {};
    if (operation.operationType === "list") {
        query.limit = { type: "number", required: false };
        query.offset = { type: "number", required: false };
    }
    // Generate body for create/update operations
    let body;
    if (operation.operationType === "create" || operation.operationType === "update") {
        if (typeof operation.config.input === "object" && operation.config.input !== null) {
            body = { fields: operation.config.input };
        }
        else if (typeof operation.config.input === "string") {
            body = { type: operation.config.input };
        }
    }
    // Generate response
    let response;
    if (operation.config.output === null) {
        // No response body (204)
        response = undefined;
    }
    else if (typeof operation.config.output === "string") {
        response = { type: operation.config.output };
    }
    else if (operation.config.output && typeof operation.config.output === "object" && "fields" in operation.config.output) {
        response = { fields: operation.config.output.fields };
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
    };
}
/**
 * Generate all endpoints from operations
 */
export function generateEndpointsFromOperations(operations, basePath) {
    return operations.map(op => generateEndpointFromOperation(op, basePath));
}
//# sourceMappingURL=generator.js.map