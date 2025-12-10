import { z } from "zod";
import { migrationCreateCommand } from "../../commands/migration-create.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  name: z.string().optional().describe("Migration name (will prompt if not provided)"),
  type: z.enum(["schema", "data", "custom"]).optional().describe("Migration type"),
  template: z.enum(["empty", "table", "column", "index"]).optional().describe("Migration template"),
});

export const yamaMigrationCreateTool = {
  name: "yama_migration_create",
  description: "Creates a new database migration file. Use this tool when the user asks to create a migration, add a migration, create migration file, or when they need to manually create a database migration for schema changes, data migrations, or custom database operations. Supports different migration types (schema, data, custom) and templates.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => migrationCreateCommand({ 
        config: args.config,
        name: args.name,
        type: args.type,
        template: args.template,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Migration created successfully\n\n${result.output}`
            : `❌ Failed to create migration\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
