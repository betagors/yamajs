import { z } from "zod";
import { schemaApplyCommand } from "../../commands/schema-apply.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  env: z.string().optional().describe("Environment name (default: development)"),
  noApply: z.boolean().optional().describe("Show what would be applied without actually applying"),
  interactive: z.boolean().optional().describe("Interactive mode (prompt for confirmation)"),
  allowDestructive: z.boolean().optional().describe("Allow destructive operations"),
});

export const yamaSchemaApplyTool = {
  name: "yama_schema_apply",
  description: "Applies schema changes and migrations to the database. Use this tool when the user asks to apply migrations, run migrations, apply schema changes, update database schema, or when they need to execute pending migrations against the database. Supports preview mode, interactive confirmation, and can allow or prevent destructive operations.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => schemaApplyCommand({ 
        config: args.config,
        env: args.env,
        noApply: args.noApply,
        interactive: args.interactive,
        allowDestructive: args.allowDestructive,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Schema applied successfully\n\n${result.output}`
            : `❌ Failed to apply schema\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
