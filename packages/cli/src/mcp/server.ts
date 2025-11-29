import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import tools
import { yamaValidateTool } from "./tools/validate.ts";
import { yamaGenerateTool } from "./tools/generate.ts";
import { yamaSchemaGenerateTool } from "./tools/schema-generate.ts";
import { yamaSchemaStatusTool } from "./tools/schema-status.ts";
import { yamaConfigTool } from "./tools/config.ts";
import { yamaEndpointsTool } from "./tools/endpoints.ts";
import { yamaSchemasTool } from "./tools/schemas.ts";
import { yamaCreateTool } from "./tools/create.ts";

// Import resources
import { getConfigResource } from "./resources/config.ts";
import { getEndpointsResource } from "./resources/endpoints.ts";
import { getSchemasResource } from "./resources/schemas.ts";
import { getMigrationStatusResource } from "./resources/migration-status.ts";

// Register all tools
const tools = [
  yamaValidateTool,
  yamaGenerateTool,
  yamaSchemaGenerateTool,
  yamaSchemaStatusTool,
  yamaConfigTool,
  yamaEndpointsTool,
  yamaSchemasTool,
  yamaCreateTool,
];

// Register all resources
const resources = [
  {
    uri: "yama://config",
    name: "YAMA Configuration",
    description: "Read yama.yaml configuration file",
    mimeType: "application/json",
  },
  {
    uri: "yama://endpoints",
    name: "YAMA Endpoints",
    description: "List all endpoints defined in yama.yaml",
    mimeType: "application/json",
  },
  {
    uri: "yama://schemas",
    name: "YAMA Schemas",
    description: "List all schemas defined in yama.yaml",
    mimeType: "application/json",
  },
  {
    uri: "yama://migration-status",
    name: "YAMA Migration Status",
    description: "Get current migration status",
    mimeType: "application/json",
  },
];

export async function createMCPServer(): Promise<Server> {
  const server = new Server(
    {
      name: "yama-cli",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${request.params.name}`);
    }

    // Parse and validate input
    const parsedInput = tool.inputSchema.parse(request.params.arguments || {});
    const result = await tool.handler(parsedInput);

    return result;
  });

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      })),
    };
  });

  // Read resources
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    try {
      switch (uri) {
        case "yama://config":
          return await getConfigResource(uri);
        case "yama://endpoints":
          return await getEndpointsResource(uri);
        case "yama://schemas":
          return await getSchemasResource(uri);
        case "yama://migration-status":
          return await getMigrationStatusResource(uri);
        default:
          throw new Error(`Resource not found: ${uri}`);
      }
    } catch (error) {
      // Provide better error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes("Config file not found")) {
          throw new Error(`Resource not available: ${uri}. ${error.message}. Make sure you're in a directory with a yama.yaml file.`);
        }
        throw new Error(`Resource not available: ${uri}. ${error.message}`);
      }
      throw error;
    }
  });

  return server;
}

export async function startMCPServer(): Promise<void> {
  const server = await createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}


