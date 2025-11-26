import { RealtimeChannel } from "./channel";
import { EntitySubscription } from "./entity-subscription";

/**
 * Client options
 */
export interface YamaRealtimeClientOptions {
  /**
   * JWT token for authentication
   */
  token?: string;
  
  /**
   * Auto-reconnect on disconnect
   */
  reconnect?: boolean;
  
  /**
   * Delay between reconnect attempts (ms)
   */
  reconnectDelay?: number;
  
  /**
   * Maximum number of reconnect attempts
   */
  maxReconnectAttempts?: number;
  
  /**
   * Error handler
   */
  onError?: (error: Error) => void;
  
  /**
   * Connection event handlers
   */
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * YAMA Realtime Client
 */
export class YamaRealtimeClient {
  private url: string;
  private options: Required<Omit<YamaRealtimeClientOptions, "onError" | "onConnect" | "onDisconnect" | "token">> & Pick<YamaRealtimeClientOptions, "onError" | "onConnect" | "onDisconnect" | "token">;
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private channels = new Map<string, RealtimeChannel>();
  private eventHandlers = new Map<string, Set<(...args: any[]) => void>>();

  constructor(url: string, options: YamaRealtimeClientOptions = {}) {
    this.url = url;
    this.options = {
      token: options.token,
      reconnect: options.reconnect !== false,
      reconnectDelay: options.reconnectDelay || 1000,
      maxReconnectAttempts: options.maxReconnectAttempts || Infinity,
      onError: options.onError,
      onConnect: options.onConnect,
      onDisconnect: options.onDisconnect,
    };
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with token if provided
        let wsUrl = this.url;
        if (this.options.token) {
          const separator = wsUrl.includes("?") ? "&" : "?";
          wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(this.options.token)}`;
        }

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit("connect");
          if (this.options.onConnect) {
            this.options.onConnect();
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        this.ws.onerror = (error) => {
          const err = new Error(`WebSocket error: ${error}`);
          this.emit("error", err);
          if (this.options.onError) {
            this.options.onError(err);
          }
          reject(err);
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit("disconnect");
          if (this.options.onDisconnect) {
            this.options.onDisconnect();
          }

          // Auto-reconnect if enabled
          if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch((error) => {
                if (this.options.onError) {
                  this.options.onError(error);
                }
              });
            }, this.options.reconnectDelay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.channels.clear();
  }

  /**
   * Get a channel
   */
  channel(channelPath: string, params?: Record<string, string>): RealtimeChannel {
    // Replace params in path (e.g., /chat/:roomId -> /chat/general)
    let resolvedPath = channelPath;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        resolvedPath = resolvedPath.replace(`:${key}`, value);
      }
    }

    if (!this.channels.has(resolvedPath)) {
      this.channels.set(resolvedPath, new RealtimeChannel(this, resolvedPath));
    }

    return this.channels.get(resolvedPath)!;
  }

  /**
   * Subscribe to entity events (convenience method)
   */
  entity(entityName: string, events?: string[]): EntitySubscription {
    return new EntitySubscription(this, entityName, events);
  }

  /**
   * Get connection state
   */
  get isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Event emitter methods
   */
  on(event: "connect" | "disconnect" | "error", handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: "connect" | "disconnect" | "error", handler?: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      if (handler) {
        handlers.delete(handler);
      } else {
        handlers.clear();
      }
    }
  }

  private emit(event: "connect" | "disconnect" | "error", ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Send a message to the server
   */
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket is not connected");
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any): void {
    if (data.type === "connected") {
      // Connection confirmed
      return;
    }

    if (data.type === "subscribed") {
      // Channel subscription confirmed
      const channel = this.channels.get(data.channel);
      if (channel) {
        channel.handleSubscribed();
      }
      return;
    }

    if (data.type === "error") {
      // Error message
      const error = new Error(data.message || "Unknown error");
      this.emit("error", error);
      if (this.options.onError) {
        this.options.onError(error);
      }
      return;
    }

    if (data.type === "pong") {
      // Pong response
      return;
    }

    // Regular event message
    if (data.channel && data.event) {
      const channel = this.channels.get(data.channel);
      if (channel) {
        channel.handleEvent(data.event, data.data);
      }
    }
  }
}

/**
 * Create a YAMA realtime client
 */
export function createYamaRealtimeClient(
  url: string,
  options?: YamaRealtimeClientOptions
): YamaRealtimeClient {
  return new YamaRealtimeClient(url, options);
}

