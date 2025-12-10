import { z } from "zod";
import { getEndpointsResource } from "../resources/endpoints.ts";

const inputSchema = z.object({
  config: z.string().optional().describe("Path to yama.yaml configuration file"),
});

export const yamaEndpointsTool = {
  name: "yama_endpoints",
  description: "Lists all API endpoints defined in the yama.yaml configuration file. Use this tool when the user asks to see endpoints, list endpoints, view routes, show API endpoints, or when you need to understand what endpoints are available in the YAMA project. This shows all HTTP endpoints with their methods, paths, handlers, and configurations.",
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
              text: "No REST endpoints defined",
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





