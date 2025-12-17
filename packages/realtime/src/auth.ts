import type { FastifyRequest } from "fastify";
import type { AuthContext, AuthConfig } from "@yamajs/core";
import { authenticateAndAuthorize } from "@yamajs/core";
import type { RealtimeChannelConfig } from "./types";

/**
 * Authenticate WebSocket connection
 */
export async function authenticateWebSocket(
  request: FastifyRequest,
  authConfig?: AuthConfig
): Promise<AuthContext | null> {
  if (!authConfig) {
    return null; // No auth required
  }

  try {
    // Extract headers from WebSocket upgrade request
    const headers: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }

    // Also check query params for token (common pattern: ?token=...)
    const query = request.query as Record<string, unknown>;
    if (query.token && typeof query.token === "string") {
      headers.authorization = `Bearer ${query.token}`;
    }

    const authResult = await authenticateAndAuthorize(
      headers,
      authConfig,
      { required: true }
    );

    return authResult.authorized ? authResult.context : null;
  } catch (error) {
    console.error("WebSocket authentication error:", error);
    return null;
  }
}

/**
 * Authorize channel access
 */
export async function authorizeChannel(
  channel: RealtimeChannelConfig,
  auth: AuthContext | null,
  params: Record<string, string>,
  customAuthHandler?: (auth: AuthContext | null, params: Record<string, string>) => Promise<boolean> | boolean
): Promise<boolean> {
  // Public channel
  if (!channel.auth?.required) {
    return true;
  }

  // Auth required but not authenticated
  if (!auth?.authenticated) {
    return false;
  }

  // Custom auth handler
  if (customAuthHandler) {
    return await customAuthHandler(auth, params);
  }

  // Default: authenticated users can access
  return true;
}

