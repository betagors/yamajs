import { z } from "zod";
import { deployCommand } from "../../commands/deploy.ts";
import { executeCommand } from "../utils/output-capture.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
  env: z.string().describe("Environment name (e.g., production, staging)"),
  plan: z.boolean().optional().describe("Show deployment plan without deploying"),
  dryRun: z.boolean().optional().describe("Perform a dry run without making changes"),
  autoRollback: z.boolean().optional().describe("Automatically rollback on failure"),
});

export const yamaDeployTool = {
  name: "yama_deploy",
  description: "Deploys schema migrations to a specified environment (production, staging, etc.). Use this tool when the user asks to deploy, deploy migrations, apply migrations to production, deploy schema changes, or when they need to push database schema changes to a remote environment. This can show a deployment plan, perform dry runs, and optionally auto-rollback on failure.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    const result = await executeCommand(
      () => deployCommand({ 
        config: args.config,
        env: args.env,
        plan: args.plan,
        dryRun: args.dryRun,
        autoRollback: args.autoRollback,
      }),
      { suppressExit: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `✅ Deployment successful\n\n${result.output}`
            : `❌ Deployment failed\n\n${result.output}\n${result.error || ""}`,
        },
      ],
    };
  },
};
