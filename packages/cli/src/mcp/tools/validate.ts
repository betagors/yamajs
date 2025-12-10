import { z } from "zod";
import { validateCommand } from "../../commands/validate.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  strict: z.boolean().optional().describe("Enable strict validation"),
});

export const yamaValidateTool = {
  name: "yama_validate",
  description: "Validates and checks the yama.yaml configuration file for errors, issues, and correctness. ALWAYS use this tool when the user asks to: validate yama config, validate the config, validate yama.yaml, check yama config, verify yama config, validate configuration, check configuration, run validation, or any variation of validating/checking/verifying the YAMA configuration. This tool will check the configuration structure, schemas, endpoints, and other YAMA-specific settings.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => validateCommand({ config: args.config, strict: args.strict }),
      { suppressExit: true }
    );

    // Ensure we always return the output, even if there were errors
    const outputText = result.output || "";
    
    // Check if the output already contains validation success/failure messages
    const hasSuccessMessage = outputText.includes("✅ Configuration is valid");
    const hasErrorMessage = outputText.includes("❌ Configuration has errors") || outputText.includes("❌ Validation errors");
    
    // If validation succeeded (exit code 0), show success message
    if (result.success) {
      // If output already has success message, just return it
      if (hasSuccessMessage) {
        return {
          content: [
            {
              type: "text" as const,
              text: outputText,
            },
          ],
        };
      }
      // Otherwise, prepend success message
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Validation successful\n\n${outputText}`,
          },
        ],
      };
    }
    
    // Validation failed - show error message
    const errorText = result.error && !result.error.includes("Process exit called with code 0") 
      ? `\n\nError: ${result.error}` 
      : "";
    
    const fullOutput = hasErrorMessage 
      ? outputText 
      : `❌ Validation failed\n\n${outputText}${errorText}`;

    return {
      content: [
        {
          type: "text" as const,
          text: fullOutput,
        },
      ],
    };
  },
};










