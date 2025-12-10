import { z } from "zod";
import { rollbackCommand } from "../../commands/rollback.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  env: z.string().describe("Environment name (e.g., production, staging)"),
  to: z.string().optional().describe("Target snapshot hash to rollback to"),
  emergency: z.boolean().optional().describe("Emergency rollback mode"),
});

export const yamaRollbackTool = {
  name: "yama_rollback",
  description: "Rolls back schema migrations to a previous snapshot or migration. Use this tool when the user asks to rollback, undo migrations, revert schema changes, rollback database, or when they need to revert database changes to a previous state. Supports emergency rollback mode for critical situations.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => rollbackCommand({ 
        config: args.config,
        env: args.env,
        to: args.to,
        emergency: args.emergency,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Rollback successful\n\n${result.output}`
            : `❌ Rollback failed\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
