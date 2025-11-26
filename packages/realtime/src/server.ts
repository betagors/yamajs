import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import websocket from "@fastify/websocket";
import type { AuthContext } from "@betagors/yama-core";
import { RealtimeAdapter, type WebSocketConnection } from "./adapter";
import { ChannelRegistry } from "./channel";
import { authenticateWebSocket, authorizeChannel } from "./auth";
import type { RealtimeConfig, RealtimeChannelConfig } from "./types";
import { setupDevTools } from "./dev-tools";

/**
 * Setup WebSocket server
 */
export async function setupWebSocketServer(
  server: FastifyInstance,
  adapter: RealtimeAdapter,
  channelRegistry: ChannelRegistry,
  config: RealtimeConfig,
  authConfig?: any,
  customAuthHandlers?: Map<string, (auth: AuthContext | null, params: Record<string, string>) => Promise<boolean> | boolean>
): Promise<void> {
  // Register WebSocket plugin
  await server.register(websocket);

  const wsPath = config.path || "/ws";

  // Register WebSocket route
  server.get(wsPath, { websocket: true }, async (connection: WebSocket, req: FastifyRequest) => {
    // Authenticate connection
    const auth = await authenticateWebSocket(req, authConfig);

    // Generate connection ID
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = auth?.user ? String((auth.user as any).id || (auth.user as any).userId || connectionId) : undefined;

    // Create connection object
    const wsConnection: WebSocketConnection = {
      socket: connection,
      auth: auth ?? undefined,
      userId,
      connectionId,
      subscribedChannels: new Set(),
    };

    // Register connection
    adapter.registerConnection(wsConnection);

    // Handle messages from client
    connection.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "subscribe") {
          await handleSubscribe(connection, wsConnection, data.channel, channelRegistry, authConfig, customAuthHandlers, adapter);
        } else if (data.type === "unsubscribe") {
          handleUnsubscribe(wsConnection, data.channel, adapter);
        } else if (data.type === "ping") {
          connection.send(JSON.stringify({ type: "pong" }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        connection.send(JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Invalid message",
        }));
      }
    });

    // Handle connection close
    connection.on("close", () => {
      adapter.unregisterConnection(connectionId);
    });

    // Handle errors
    connection.on("error", (error: Error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      adapter.unregisterConnection(connectionId);
    });

    // Send connection confirmation
    connection.send(JSON.stringify({
      type: "connected",
      connectionId,
    }));
  });

  // Setup dev tools if enabled
  if (config.dev?.inspectorUI) {
    setupDevTools(server, adapter, wsPath);
  }
}

/**
 * Handle channel subscription
 */
async function handleSubscribe(
  connection: WebSocket,
  wsConnection: WebSocketConnection,
  channelPath: string,
  channelRegistry: ChannelRegistry,
  authConfig?: {
    providers?: unknown[];
  },
  customAuthHandlers?: Map<string, (auth: AuthContext | null, params: Record<string, string>) => Promise<boolean> | boolean>,
  adapter?: RealtimeAdapter
): Promise<void> {
  // Find channel by path
  const match = channelRegistry.findChannel(channelPath);
  if (!match) {
    connection.send(JSON.stringify({
      type: "error",
      message: `Channel not found: ${channelPath}`,
    }));
    return;
  }

  const { channel, params } = match;

  // Check authorization
  const customHandler = customAuthHandlers?.get(channel.config.name);
  const authorized = await authorizeChannel(
    channel.config,
    wsConnection.auth || null,
    params,
    customHandler
  );

  if (!authorized) {
    connection.send(JSON.stringify({
      type: "error",
      message: "Unauthorized",
    }));
    return;
  }

  // Subscribe to channel
  if (adapter) {
    adapter.subscribe(wsConnection.connectionId, channelPath);
  }

  connection.send(JSON.stringify({
    type: "subscribed",
    channel: channelPath,
  }));
}

/**
 * Handle channel unsubscription
 */
function handleUnsubscribe(
  wsConnection: WebSocketConnection,
  channelPath: string,
  adapter: RealtimeAdapter
): void {
  adapter.unsubscribe(wsConnection.connectionId, channelPath);
}

