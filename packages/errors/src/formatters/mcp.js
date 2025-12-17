/**
 * Format a YamaError for MCP (Model Context Protocol) tool response.
 *
 * MCP tools return results with a content array and an isError flag.
 * This function formats YamaError into that structure.
 *
 * @param error - The YamaError to format
 * @param options - Formatting options
 * @returns MCP tool result with isError: true
 *
 * @example
 * ```typescript
 * const mcpResult = formatMCPError(error);
 * // {
 * //   content: [{ type: 'text', text: '...' }],
 * //   isError: true
 * // }
 * ```
 */
export function formatMCPError(error, options = {}) {
    const { includeSuggestions = true, includeContext = false, } = options;
    // Build the error text
    let text = `Error [${error.code}]: ${error.message}`;
    // Add validation details
    if (error.details && error.details.length > 0) {
        text += '\n\nValidation Errors:';
        for (const detail of error.details) {
            if (detail.field) {
                text += `\n  - ${detail.field}: ${detail.message}`;
            }
            else {
                text += `\n  - ${detail.message}`;
            }
        }
    }
    // Add context
    if (includeContext && error.context) {
        text += '\n\nContext:';
        text += `\n${JSON.stringify(error.context, null, 2)}`;
    }
    // Add suggestions
    if (includeSuggestions && error.suggestions && error.suggestions.length > 0) {
        text += '\n\nSuggestions:';
        for (const suggestion of error.suggestions) {
            text += `\n  - ${suggestion}`;
        }
    }
    return {
        content: [
            {
                type: 'text',
                text,
            },
        ],
        isError: true,
    };
}
/**
 * Create a successful MCP tool result with text content
 */
export function createMCPTextResult(text) {
    return {
        content: [
            {
                type: 'text',
                text,
            },
        ],
    };
}
/**
 * Create a successful MCP tool result with JSON content
 */
export function createMCPJsonResult(data) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(data, null, 2),
            },
        ],
    };
}
//# sourceMappingURL=mcp.js.map