import type { WebSocket } from "@fastify/websocket";
import type { AuthContext } from "@yamajs/kernel";

/**
 * WebSocket connection with metadata
 */
export interface WebSocketConnection {
  socket: WebSocket;
  auth?: AuthContext;
  userId?: string;
  connectionId: string;
  subscribedChannels: Set<string>;
}

/**
 * Realtime adapter for managing WebSocket connections and publishing events
 */
export class RealtimeAdapter {
  private connections = new Map<string, WebSocketConnection>();
  private channelSubscriptions = new Map<string, Set<string>>(); // channel -> Set<connectionId>
  private redisClient: any = null;
  private redisSubscriber: any = null;
  private useRedis: boolean = false;
  private eventLog: Array<{ channel: string; event: string; data: unknown; timestamp: number }> = [];
  private maxEventLogSize = 100;

  constructor(redisClient?: any, useRedis: boolean = false) {
    this.useRedis = useRedis && redisClient !== null && redisClient !== undefined;
    if (this.useRedis && redisClient) {
      this.redisClient = redisClient;
      this.setupRedisSubscription();
    }
  }

  /**
   * Setup Redis pub/sub subscription for distributed realtime
   */
  private async setupRedisSubscription() {
    if (!this.useRedis || !this.redisClient) return;

    try {
      // Create a duplicate client for subscribing (Redis requirement)
      if (typeof this.redisClient.duplicate === "function") {
        this.redisSubscriber = this.redisClient.duplicate();
      } else if (typeof this.redisClient.clone === "function") {
        this.redisSubscriber = this.redisClient.clone();
      } else {
        // Fallback: use the same client (may not work for all Redis clients)
        this.redisSubscriber = this.redisClient;
      }

      // Subscribe to realtime:* pattern
      if (typeof this.redisSubscriber.psubscribe === "function") {
        await this.redisSubscriber.psubscribe("realtime:*");
      } else if (typeof this.redisSubscriber.subscribe === "function") {
        await this.redisSubscriber.subscribe("realtime:*");
      }

      // Handle messages from Redis
      if (typeof this.redisSubscriber.on === "function") {
        this.redisSubscriber.on("pmessage", (pattern: string, channel: string, message: string) => {
          this.handleRedisMessage(channel, message);
        });
        this.redisSubscriber.on("message", (channel: string, message: string) => {
          this.handleRedisMessage(channel, message);
        });
      }
    } catch (error) {
      console.warn("âš ï¸  Failed to setup Redis pub/sub for realtime:", error instanceof Error ? error.message : String(error));
      this.useRedis = false;
    }
  }

  /**
   * Handle message from Redis pub/sub
   */
  private handleRedisMessage(channel: string, message: string) {
    try {
      const data = JSON.parse(message);
      const { event, payload, targetChannel, options } = data;
      
      // Only broadcast to local clients (avoid echo)
      this.broadcastToLocalClients(targetChannel, event, payload, options);
    } catch (error) {
      console.error("Failed to handle Redis message:", error);
    }
  }

  /**
   * Register a new WebSocket connection
   */
  registerConnection(connection: WebSocketConnection): void {
    this.connections.set(connection.connectionId, connection);
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Remove from all channel subscriptions
      for (const channel of connection.subscribedChannels) {
        const subscribers = this.channelSubscriptions.get(channel);
        if (subscribers) {
          subscribers.delete(connectionId);
          if (subscribers.size === 0) {
            this.channelSubscriptions.delete(channel);
          }
        }
      }
      this.connections.delete(connectionId);
    }
  }

  /**
   * Subscribe a connection to a channel
   */
  subscribe(connectionId: string, channel: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscribedChannels.add(channel);
    
    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(connectionId);
  }

  /**
   * Unsubscribe a connection from a channel
   */
  unsubscribe(connectionId: string, channel: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscribedChannels.delete(channel);
    }

    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }
  }

  /**
   * Publish an event to a channel
   */
  async publish(
    channel: string,
    event: string,
    data: unknown,
    options?: {
      userId?: string;
      excludeUserId?: string;
    }
  ): Promise<void> {
    try {
      // Publish to Redis if enabled
      if (this.useRedis && this.redisClient) {
        const message = JSON.stringify({
          event,
          payload: data,
          targetChannel: channel,
          options,
        });
        
        if (typeof this.redisClient.publish === "function") {
          await this.redisClient.publish(`realtime:${channel}`, message);
        }
      }

      // Broadcast to local clients
      this.broadcastToLocalClients(channel, event, data, options);

      // Log event
      this.logEvent(channel, event, data);
    } catch (error) {
      throw new Error(`Failed to publish realtime event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Publish an event asynchronously (fire-and-forget)
   */
  publishAsync(
    channel: string,
    event: string,
    data: unknown,
    options?: {
      userId?: string;
      excludeUserId?: string;
    }
  ): void {
    this.publish(channel, event, data, options).catch((error) => {
      console.error(`[Realtime] Failed to publish async event to ${channel}:`, error);
    });
  }

  /**
   * Broadcast to all clients in a channel
   */
  async broadcast(
    channel: string,
    event: string,
    data: unknown,
    options?: {
      userId?: string;
      excludeUserId?: string;
    }
  ): Promise<void> {
    await this.publish(channel, event, data, options);
  }

  /**
   * Broadcast to local clients only (used by Redis message handler)
   */
  private broadcastToLocalClients(
    channel: string,
    event: string,
    data: unknown,
    options?: {
      userId?: string;
      excludeUserId?: string;
    }
  ): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify({
      channel,
      event,
      data,
      timestamp: Date.now(),
    });

    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId);
      if (!connection) continue;

      // Apply user filtering
      if (options?.userId && connection.userId !== options.userId) {
        continue;
      }
      if (options?.excludeUserId && connection.userId === options.excludeUserId) {
        continue;
      }

      try {
        if (connection.socket.readyState === 1) { // WebSocket.OPEN
          connection.socket.send(message);
        }
      } catch (error) {
        console.error(`Failed to send message to connection ${connectionId}:`, error);
        // Remove dead connection
        this.unregisterConnection(connectionId);
      }
    }
  }

  /**
   * Get connected clients for a channel
   */
  async getClients(channel: string): Promise<string[]> {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers) return [];

    const clients: string[] = [];
    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        clients.push(connection.userId || connection.connectionId);
      }
    }
    return clients;
  }

  /**
   * Get all connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get event log
   */
  getEventLog(): Array<{ channel: string; event: string; data: unknown; timestamp: number }> {
    return [...this.eventLog];
  }

  /**
   * Log an event
   */
  private logEvent(channel: string, event: string, data: unknown): void {
    this.eventLog.push({
      channel,
      event,
      data,
      timestamp: Date.now(),
    });

    // Keep log size manageable
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog.shift();
    }
  }

  /**
   * Check if realtime is available
   */
  get available(): boolean {
    return true; // Always available once initialized
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.socket.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.connections.clear();
    this.channelSubscriptions.clear();

    // Close Redis subscriber
    if (this.redisSubscriber && typeof this.redisSubscriber.quit === "function") {
      await this.redisSubscriber.quit();
    }
  }
}

