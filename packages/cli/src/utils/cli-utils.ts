import chalk from "chalk";
import boxen, { type Options as BoxenOptions } from "boxen";
import ora, { type Ora } from "ora";
import { table } from "table";

/**
 * Color utilities for CLI output
 */
export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  dim: chalk.dim,
  bold: chalk.bold,
  cyan: chalk.cyan,
};

/**
 * Formatting helpers for concise output
 */
export const fmt = {
  bold: chalk.bold,
  dim: chalk.dim,
  green: chalk.green,
  red: chalk.red,
  yellow: chalk.yellow,
  cyan: chalk.cyan,
  blue: chalk.blue,
  magenta: chalk.magenta,
  white: chalk.white,
  gray: chalk.gray,
};

/**
 * Dim text helper
 */
export function dim(text: string): string {
  return chalk.dim(text);
}

/**
 * Print a success message
 */
export function success(message: string): void {
  console.log(colors.success(`✅ ${message}`));
}

/**
 * Print an error message
 */
export function error(message: string): void {
  console.error(colors.error(`❌ ${message}`));
}

/**
 * Print a warning message
 */
export function warning(message: string): void {
  console.log(colors.warning(`⚠️  ${message}`));
}

/**
 * Print an info message
 */
export function info(message: string): void {
  console.log(colors.info(`ℹ️  ${message}`));
}

/**
 * Print a pending/loading message
 */
export function pending(message: string): void {
  console.log(colors.dim(`⏳ ${message}`));
}

/**
 * Create a boxed message
 */
export function box(message: string, options?: BoxenOptions): string {
  return boxen(message, {
    padding: 1,
    borderColor: "cyan",
    borderStyle: "round",
    ...options,
  });
}

/**
 * Print a boxed message
 */
export function printBox(message: string, options?: BoxenOptions): void {
  console.log(box(message, options));
}

/**
 * Create a table from data
 */
export function createTable(data: unknown[][]): string {
  return table(data, {
    border: {
      topBody: "─",
      topJoin: "┬",
      topLeft: "┌",
      topRight: "┐",
      bottomBody: "─",
      bottomJoin: "┴",
      bottomLeft: "└",
      bottomRight: "┘",
      bodyLeft: "│",
      bodyRight: "│",
      bodyJoin: "│",
      joinBody: "─",
      joinLeft: "├",
      joinRight: "┤",
      joinJoin: "┼",
    },
  });
}

/**
 * Print a table
 */
export function printTable(data: unknown[][]): void {
  console.log(createTable(data));
}

/**
 * Create a spinner
 */
export function createSpinner(text: string): Ora {
  return ora(text).start();
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format file size to human-readable string
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/**
 * Print contextual hints after a command
 */
export function printHints(hints: string[]): void {
  if (hints.length === 0) return;
  
  console.log(colors.dim("\n💡 Next steps:"));
  hints.forEach((hint) => {
    console.log(colors.dim(`   ${hint}`));
  });
}

/**
 * Print related commands
 */
export function printRelatedCommands(commands: string[]): void {
  if (commands.length === 0) return;
  
  console.log(colors.dim("\n📚 Related commands:"));
  commands.forEach((cmd) => {
    console.log(colors.dim(`   yama ${cmd}`));
  });
}

