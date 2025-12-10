import { z } from "zod";
import { createCommand } from "../../commands/create.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  projectName: z.string().optional().describe("Project name or '.' for current directory"),
  database: z.string().optional().describe("Database type (postgresql, none)"),
  yes: z.boolean().optional().describe("Use default options (non-interactive mode)"),
});

export const yamaCreateTool = {
  name: "yama_create",
  description: "Creates a new YAMA project from scratch. Use this tool when the user asks to create a new project, start a new YAMA project, initialize a new project, or set up a new YAMA application. This will create the project structure, configuration files, and optionally set up database integration. This tool does NOT require an existing yama.yaml file - it creates a new project from scratch. Works in any directory, even empty ones.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () =>
        createCommand(args.projectName, {
          database: args.database,
          yes: args.yes,
        }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Project creation successful\n\n${result.output}`
            : `❌ Project creation failed\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};










