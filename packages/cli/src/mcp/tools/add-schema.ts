import { z } from "zod";
import { addSchemaCommand } from "../../commands/add-schema.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaAddSchemaTool = {
  name: "yama_add_schema",
  description: "Adds a new data schema to the yama.yaml configuration file. Use this tool when the user asks to add a schema, create a schema, define a data model, add a data type, or create a new schema definition. This tool will interactively prompt for schema details like name, fields, types, and validation rules.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => addSchemaCommand({ config: args.config }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Schema added successfully\n\n${result.output}`
            : `❌ Failed to add schema\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
