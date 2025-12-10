import { z } from "zod";
import { schemaStatusCommand } from "../../commands/schema-status.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  short: z.boolean().optional().describe("Short output format"),
  env: z.string().optional().describe("Environment (local, staging, prod)"),
});

export const yamaSchemaStatusTool = {
  name: "yama_migration_status",
  description: "Checks the status of database migrations to see which migrations have been applied and which are pending. Use this tool when the user asks to check migration status, see migration status, list migrations, check which migrations are applied, or when you need to understand the current state of database migrations in the project.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () =>
        schemaStatusCommand({
          config: args.config,
          short: args.short,
          env: args.env,
        }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `📊 Migration Status\n\n${result.output}`
            : `❌ Failed to check migration status\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};







