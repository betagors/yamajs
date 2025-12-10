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
 * Returns output even if the function throws an error
 */
export async function captureOutput<T>(
  fn: () => Promise<T>
): Promise<{ result?: T; output: CapturedOutput; error?: unknown }> {
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

  const output: CapturedOutput = {
    stdout: "",
    stderr: "",
  };

  let result: T | undefined;
  let error: unknown;

  try {
    result = await fn();
  } catch (err) {
    error = err;
  } finally {
    // Capture output before restoring console methods
    output.stdout = stdoutChunks.join("");
    output.stderr = stderrChunks.join("");
    
    // Restore original streams and console methods
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
  
  if (error) {
    return { output, error };
  }
  
  return {
    result: result!,
    output,
  };
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
  let capturedOutput: CapturedOutput | null = null;

  // Override process.exit to capture exit code
  if (options?.suppressExit) {
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`Process exit called with code ${code ?? 0}`);
    }) as typeof process.exit;
  }

  try {
    const captureResult = await captureOutput(fn);
    capturedOutput = captureResult.output;
    const success = exitCode === null || exitCode === 0;
    const combinedOutput = captureResult.output.stdout + captureResult.output.stderr;

    // If there was an error but we have output, return it
    if (captureResult.error) {
      const errorMessage = captureResult.error instanceof Error ? captureResult.error.message : String(captureResult.error);
      const isExitError = errorMessage.includes("Process exit called");

      if (isExitError && exitCode !== null) {
        // For successful exits (code 0), don't include error message
        // The output should already contain success/failure messages from the command
        return {
          success: exitCode === 0,
          output: combinedOutput,
          error: exitCode !== 0 ? `Command exited with code ${exitCode}` : undefined,
          data: captureResult.result,
        };
      }

      return {
        success: false,
        output: combinedOutput,
        error: errorMessage,
        data: captureResult.result,
      };
    }

    return {
      success,
      output: combinedOutput,
      data: captureResult.result,
    };
  } catch (error) {
    // Fallback error handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    const outputText = capturedOutput 
      ? capturedOutput.stdout + capturedOutput.stderr 
      : "";

    return {
      success: false,
      output: outputText,
      error: errorMessage,
    };
  } finally {
    process.exit = originalExit;
  }
}











