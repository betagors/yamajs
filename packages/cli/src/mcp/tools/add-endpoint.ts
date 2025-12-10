import { z } from "zod";
import { addEndpointCommand } from "../../commands/add-endpoint.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaAddEndpointTool = {
  name: "yama_add_endpoint",
  description: "Adds a new API endpoint to the yama.yaml configuration file. Use this tool when the user asks to add an endpoint, create an endpoint, add a route, create a new API endpoint, or define a new HTTP endpoint. This tool will interactively prompt for endpoint details like method (GET, POST, etc.), path, handler, and other configuration options.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => addEndpointCommand({ config: args.config }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Endpoint added successfully\n\n${result.output}`
            : `❌ Failed to add endpoint\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
