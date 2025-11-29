import { z } from "zod";
import { generateCommand } from "../../commands/generate.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  output: z.string().optional().describe("Output path for generated files"),
  typesOnly: z.boolean().optional().describe("Generate types only"),
  sdkOnly: z.boolean().optional().describe("Generate SDK only"),
  framework: z.string().optional().describe("Framework type (nextjs, react, node)"),
  noCache: z.boolean().optional().describe("Disable caching"),
});

export const yamaGenerateTool = {
  name: "yama_generate",
  description: "Generate TypeScript types and SDK from yama.yaml configuration",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () =>
        generateCommand({
          config: args.config,
          output: args.output,
          typesOnly: args.typesOnly,
          sdkOnly: args.sdkOnly,
          framework: args.framework,
          noCache: args.noCache,
        }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Generation successful\n\n${result.output}`
            : `❌ Generation failed\n\n${result.output}\n${result.error || ""}`,
        },
      ],
      isError: !result.success,
    };
  },
};
