import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { resolveEnvVars, loadEnvFile, setPluginRegistryConfig, loadPlugin, getAllMCPTools } from "@betagors/yama-core";
import type { PluginMCPTool } from "@betagors/yama-core";
import { zodToJsonSchema } from "zod-to-json-schema";

// Import tools
import { yamaValidateTool } from "./tools/validate.ts";
import { yamaGenerateTool } from "./tools/generate.ts";
import { yamaSchemaGenerateTool as yamaMigrationGenerateTool } from "./tools/schema-generate.ts";
import { yamaSchemaStatusTool as yamaMigrationStatusTool } from "./tools/schema-status.ts";
import { yamaConfigTool } from "./tools/config.ts";
import { yamaEndpointsTool } from "./tools/endpoints.ts";
import { yamaSchemasTool } from "./tools/schemas.ts";
import { yamaCreateTool } from "./tools/create.ts";
import { yamaAddEndpointTool } from "./tools/add-endpoint.ts";
import { yamaAddHandlerTool } from "./tools/add-handler.ts";
import { yamaAddSchemaTool } from "./tools/add-schema.ts";
import { yamaAddPluginTool } from "./tools/add-plugin.ts";
import { yamaDeployTool } from "./tools/deploy.ts";
import { yamaRollbackTool } from "./tools/rollback.ts";
import { yamaInitTool } from "./tools/init.ts";
import { yamaMigrationCreateTool } from "./tools/migration-create.ts";
import { yamaAddEntityTool } from "./tools/add-entity.ts";
import { yamaRemovePluginTool } from "./tools/remove-plugin.ts";
import { yamaResolveTool } from "./tools/resolve.ts";
import { yamaSchemaApplyTool } from "./tools/schema-apply.ts";
import { yamaSchemaCheckTool } from "./tools/schema-check.ts";
import { yamaPluginRecommendTool } from "./tools/plugin-recommend.ts";
import { yamaPluginSelectTool } from "./tools/plugin-select.ts";
import { yamaPluginConfigureTool } from "./tools/plugin-configure.ts";
import { yamaSchemaValidateTool } from "./tools/schema-validate.ts";
import { yamaSchemaGenerateTool } from "./tools/schema-generate-from-description.ts";

// Import resources
import { getConfigResource } from "./resources/config.ts";
import { getEndpointsResource } from "./resources/endpoints.ts";
import { getSchemasResource } from "./resources/schemas.ts";
import { getMigrationStatusResource } from "./resources/migration-status.ts";
import { getSchemaSyntaxResource } from "./resources/schema-syntax.ts";
import { getSchemaExamplesResource } from "./resources/schema-examples.ts";
import { getTypeSystemResource } from "./resources/type-system.ts";

// Core tools (always available)
const coreTools = [
  yamaValidateTool,
  yamaGenerateTool,
  yamaMigrationGenerateTool,
  yamaMigrationStatusTool,
  yamaConfigTool,
  yamaEndpointsTool,
  yamaSchemasTool,
  yamaCreateTool,
  yamaAddEndpointTool,
  yamaAddHandlerTool,
  yamaAddSchemaTool,
  yamaAddPluginTool,
  yamaDeployTool,
  yamaRollbackTool,
  yamaInitTool,
  yamaMigrationCreateTool,
  yamaAddEntityTool,
  yamaRemovePluginTool,
  yamaResolveTool,
  yamaSchemaApplyTool,
  yamaSchemaCheckTool,
  yamaPluginRecommendTool,
  yamaPluginSelectTool,
  yamaPluginConfigureTool,
  yamaSchemaValidateTool,
  yamaSchemaGenerateTool,
];

/**
 * Load plugin tools from yama.yaml
 */
async function loadPluginTools(): Promise<PluginMCPTool[]> {
  const yamaConfigPath = findYamaConfig() || "yama.yaml";
  
  if (!existsSync(yamaConfigPath)) {
    return [];
  }

  try {
    const environment = process.env.NODE_ENV || "development";
    loadEnvFile(yamaConfigPath, environment);
    let config = readYamaConfig(yamaConfigPath) as {
      plugins?: Record<string, Record<string, unknown>> | string[];
    };
    config = resolveEnvVars(config) as typeof config;
    const configDir = getConfigDir(yamaConfigPath);

    // Set plugin registry config
    setPluginRegistryConfig(config, configDir);

    // Get plugin list - plugins must be an array
    const pluginEntries: Array<{ name: string; config: Record<string, unknown> }> = [];
    if (config.plugins) {
      if (!Array.isArray(config.plugins)) {
        throw new Error("plugins must be an array. Format: ['@plugin/name'] or [{ '@plugin/name': { config: {...} } }]");
      }

      for (const pluginItem of config.plugins) {
        if (typeof pluginItem === "string") {
          // String shorthand: "@betagors/yama-pglite"
          pluginEntries.push({ name: pluginItem, config: {} });
        } else if (pluginItem && typeof pluginItem === "object") {
          // Object format: { "@betagors/yama-redis": { config: {...} } }
          const keys = Object.keys(pluginItem);
          if (keys.length !== 1) {
            throw new Error(`Plugin object must have exactly one key (plugin name), got: ${keys.join(", ")}`);
          }
          const pluginName = keys[0];
          const pluginValue = pluginItem[pluginName];
          const pluginConfig = pluginValue && typeof pluginValue === "object" && "config" in pluginValue
            ? (pluginValue.config as Record<string, unknown> || {})
            : {};
          pluginEntries.push({ name: pluginName, config: pluginConfig });
        } else {
          throw new Error(`Invalid plugin item: expected string or object, got ${typeof pluginItem}`);
        }
      }
    }

    // Load all plugins
    for (const { name: pluginName, config: pluginConfig } of pluginEntries) {
      try {
        await loadPlugin(pluginName, configDir, pluginConfig);
      } catch (error) {
        // Log but don't fail - some plugins might not be installed
        console.warn(`Warning: Failed to load plugin ${pluginName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Get all MCP tools from loaded plugins
    return getAllMCPTools();
  } catch (error) {
    // If loading fails, return empty array
    console.warn(`Warning: Failed to load plugin tools: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

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
  {
    uri: "schema://docs/syntax",
    name: "YAML Schema Syntax Documentation",
    description: "Complete syntax reference for entity schemas",
    mimeType: "text/markdown",
  },
  {
    uri: "schema://docs/examples",
    name: "Schema Examples",
    description: "Common schema patterns and examples",
    mimeType: "text/markdown",
  },
  {
    uri: "schema://docs/type-system",
    name: "Type System Documentation",
    description: "Complete reference for YAMA's schema-first type system",
    mimeType: "text/markdown",
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

  // Load plugin tools
  const pluginTools = await loadPluginTools();
  
  // Combine core tools and plugin tools
  const allTools = [...coreTools, ...pluginTools];

  /**
   * Convert Zod schema to JSON Schema for MCP
   */
  function convertInputSchemaToJsonSchema(schema: any): any {
    // If it's already a JSON Schema (has type property and no parse method), return as-is
    if (schema && typeof schema === "object" && !schema.parse && (schema.type || schema.properties)) {
      return schema;
    }
    
    // If it's a Zod schema (has parse method), convert it
    if (schema && typeof schema.parse === "function") {
      try {
        return zodToJsonSchema(schema, {
          target: "openApi3",
          $refStrategy: "none",
        });
      } catch (error) {
        console.warn(`Failed to convert Zod schema to JSON Schema: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to a basic schema
        return {
          type: "object",
          properties: {},
        };
      }
    }
    
    // Fallback for unknown schema types
    return {
      type: "object",
      properties: {},
    };
  }

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: convertInputSchemaToJsonSchema(tool.inputSchema),
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = allTools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${request.params.name}`);
    }

    // Parse and validate input
    // Handle both core tools (with parse method) and plugin tools (with parse method)
    let parsedInput: any;
    if (typeof tool.inputSchema.parse === "function") {
      parsedInput = tool.inputSchema.parse(request.params.arguments || {});
    } else {
      // Fallback for non-zod schemas (shouldn't happen, but be safe)
      parsedInput = request.params.arguments || {};
    }
    
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
        case "schema://docs/syntax":
          return await getSchemaSyntaxResource(uri);
        case "schema://docs/examples":
          return await getSchemaExamplesResource(uri);
        case "schema://docs/type-system":
          return await getTypeSystemResource(uri);
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


