import { z } from "zod";
import { schemaGenerateCommand } from "../../commands/schema-generate.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  name: z.string().optional().describe("Migration name"),
  preview: z.boolean().optional().describe("Preview changes without generating files"),
  interactive: z.boolean().optional().describe("Interactive mode"),
});

export const yamaSchemaGenerateTool = {
  name: "yama_schema_generate",
  description: "Generate migration from schema changes in yama.yaml",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () =>
        schemaGenerateCommand({
          config: args.config,
          name: args.name,
          preview: args.preview,
          interactive: args.interactive,
        }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Migration generation successful\n\n${result.output}`
            : `❌ Migration generation failed\n\n${result.output}\n${result.error || ""}`,
        },
      ],
      isError: !result.success,
    };
  },
};
