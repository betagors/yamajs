import { YamaError } from '../base.js';
/**
 * MCP tool result content types
 */
export interface MCPToolResultContent {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
}
/**
 * MCP tool result format
 */
export interface MCPToolResult {
    content: MCPToolResultContent[];
    isError?: boolean;
}
/**
 * Options for formatting MCP errors
 */
export interface FormatMCPErrorOptions {
    /** Whether to include suggestions */
    includeSuggestions?: boolean;
    /** Whether to include context */
    includeContext?: boolean;
}
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
export declare function formatMCPError(error: YamaError, options?: FormatMCPErrorOptions): MCPToolResult;
/**
 * Create a successful MCP tool result with text content
 */
export declare function createMCPTextResult(text: string): MCPToolResult;
/**
 * Create a successful MCP tool result with JSON content
 */
export declare function createMCPJsonResult(data: unknown): MCPToolResult;
//# sourceMappingURL=mcp.d.ts.map