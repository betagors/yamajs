/**
 * MCP-specific type definitions for YAMA CLI
 */

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
}

export interface CapturedOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

















