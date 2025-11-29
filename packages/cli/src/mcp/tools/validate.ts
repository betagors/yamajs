import { z } from "zod";
import { validateCommand } from "../../commands/validate.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  strict: z.boolean().optional().describe("Enable strict validation"),
});

export const yamaValidateTool = {
  name: "yama_validate",
  description: "Validate yama.yaml configuration file for errors and issues",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => validateCommand({ config: args.config, strict: args.strict }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Validation successful\n\n${result.output}`
            : `❌ Validation failed\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};






