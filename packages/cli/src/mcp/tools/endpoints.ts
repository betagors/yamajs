import { z } from "zod";
import { getEndpointsResource } from "../resources/endpoints.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaEndpointsTool = {
  name: "yama_endpoints",
  description: "List all endpoints defined in yama.yaml (uses yama://endpoints resource)",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    try {
      // Use the same resource handler to ensure consistency
      const resource = await getEndpointsResource("yama://endpoints");
      const endpointsJson = resource.contents[0]?.text || "[]";
      const endpoints = JSON.parse(endpointsJson);

      if (!endpoints || endpoints.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No endpoints defined",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `📡 Endpoints (${endpoints.length}):\n\n${endpointsJson}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to read endpoints: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};





