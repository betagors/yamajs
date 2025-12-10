import { z } from "zod";
import { addEntityCommand } from "../../commands/add-entity.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaAddEntityTool = {
  name: "yama_add_entity",
  description: "Adds a new database entity to the yama.yaml configuration file. Use this tool when the user asks to add an entity, create an entity, define a database table, add a data model, or create a new database entity. This tool will interactively prompt for entity details like name, fields, relationships, and database-specific options.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => addEntityCommand({ config: args.config }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Entity added successfully\n\n${result.output}`
            : `❌ Failed to add entity\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
