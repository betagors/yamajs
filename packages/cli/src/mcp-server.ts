#!/usr/bin/env node
/**
 * MCP Server Entry Point for YAMA CLI
 * 
 * This file starts the MCP server that exposes YAMA CLI commands
 * as tools and project data as resources for AI assistants.
 */

import { startMCPServer } from "./mcp/server.ts";

// Set environment for MCP
process.env.CI = "true";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

startMCPServer().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});











