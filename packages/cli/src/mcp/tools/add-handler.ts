import { z } from "zod";
import { addHandlerCommand } from "../../commands/add-handler.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  name: z.string().describe("Handler function name"),
  force: z.boolean().optional().describe("Overwrite existing handler file if it exists"),
});

export const yamaAddHandlerTool = {
  name: "yama_add_handler",
  description: "Creates a new handler function file for an endpoint. Use this tool when the user asks to create a handler, add a handler, create handler file, or when they need to implement the business logic for an endpoint. This generates a TypeScript handler file with the specified name that can be used to process requests for an endpoint.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => addHandlerCommand({ 
        config: args.config,
        name: args.name,
        force: args.force,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Handler created successfully\n\n${result.output}`
            : `❌ Failed to create handler\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
