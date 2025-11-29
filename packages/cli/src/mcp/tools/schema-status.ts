import { z } from "zod";
import { schemaStatusCommand } from "../../commands/schema-status.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  short: z.boolean().optional().describe("Short output format"),
  env: z.string().optional().describe("Environment (local, staging, prod)"),
});

export const yamaSchemaStatusTool = {
  name: "yama_schema_status",
  description: "Check migration status - see which migrations are applied and pending",
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







