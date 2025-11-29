/**
 * Utility to capture console output from CLI commands
 */

import { Writable } from "stream";

export interface CapturedOutput {
  stdout: string;
  stderr: string;
}

/**
 * Capture stdout and stderr from a function execution
 */
export async function captureOutput<T>(
  fn: () => Promise<T>
): Promise<{ result: T; output: CapturedOutput }> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  // Create writable streams to capture output
  const stdoutCapture = new Writable({
    write(chunk, encoding, callback) {
      stdoutChunks.push(chunk.toString());
      callback();
    },
  });

  const stderrCapture = new Writable({
    write(chunk, encoding, callback) {
      stderrChunks.push(chunk.toString());
      callback();
    },
  });

  // Store original streams
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Override console methods
  console.log = (...args: unknown[]) => {
    stdoutChunks.push(args.map(String).join(" ") + "\n");
  };

  console.error = (...args: unknown[]) => {
    stderrChunks.push(args.map(String).join(" ") + "\n");
  };

  console.warn = (...args: unknown[]) => {
    stderrChunks.push(args.map(String).join(" ") + "\n");
  };

  try {
    const result = await fn();
    return {
      result,
      output: {
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      },
    };
  } finally {
    // Restore original streams and console methods
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
}

/**
 * Execute a command function and return structured result
 */
export async function executeCommand<T>(
  fn: () => Promise<T>,
  options?: { suppressExit?: boolean }
): Promise<{ success: boolean; output: string; error?: string; data?: T }> {
  const originalExit = process.exit;
  let exitCode: number | null = null;

  // Override process.exit to capture exit code
  if (options?.suppressExit) {
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`Process exit called with code ${code ?? 0}`);
    }) as typeof process.exit;
  }

  try {
    const { result, output } = await captureOutput(fn);
    const success = exitCode === null || exitCode === 0;

    return {
      success,
      output: output.stdout + output.stderr,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isExitError = errorMessage.includes("Process exit called");

    if (isExitError && exitCode !== null) {
      return {
        success: exitCode === 0,
        output: "",
        error: exitCode !== 0 ? `Command exited with code ${exitCode}` : undefined,
      };
    }

    return {
      success: false,
      output: "",
      error: errorMessage,
    };
  } finally {
    process.exit = originalExit;
  }
}






