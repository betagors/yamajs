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
  description: "Generates TypeScript types, SDK, and client code from your yama.yaml configuration file. Use this tool when the user asks to generate types, generate SDK, generate code, create types, build types, or when they need to regenerate code after making changes to their YAMA configuration. This tool creates TypeScript type definitions and SDK code that can be used in your application to interact with your YAMA API endpoints.",
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
    };
  },
};










