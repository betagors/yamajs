// REST API formatter
export {
  formatRestError,
  getRestErrorHeaders,
  type RestErrorResponse,
  type FormatRestErrorOptions,
} from './rest.js';

// GraphQL formatter
export {
  formatGraphQLError,
  formatGraphQLErrors,
  type GraphQLFormattedError,
  type GraphQLErrorLocation,
  type GraphQLErrorExtensions,
  type FormatGraphQLErrorOptions,
} from './graphql.js';

// MCP formatter
export {
  formatMCPError,
  createMCPTextResult,
  createMCPJsonResult,
  type MCPToolResult,
  type MCPToolResultContent,
  type FormatMCPErrorOptions,
} from './mcp.js';
