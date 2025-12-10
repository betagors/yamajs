import { z } from "zod";
import { initCommand } from "../../commands/init.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  name: z.string().optional().describe("Project name"),
  version: z.string().optional().describe("Project version (default: 1.0.0)"),
});

export const yamaInitTool = {
  name: "yama_init",
  description: "Initializes a new YAMA project in the current directory. Use this tool when the user asks to initialize a project, init YAMA, set up YAMA, or when they want to create a yama.yaml configuration file in an existing project. This will interactively prompt for project details and database plugin selection.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => initCommand({ 
        name: args.name,
        version: args.version,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Project initialized successfully\n\n${result.output}`
            : `❌ Failed to initialize project\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
