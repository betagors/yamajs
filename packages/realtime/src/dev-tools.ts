import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { RealtimeAdapter } from "./adapter";

/**
 * Setup development tools
 */
export function setupDevTools(
  server: FastifyInstance,
  adapter: RealtimeAdapter,
  wsPath: string
): void {
  // Inspector UI
  server.get("/realtime-inspector", async (request: FastifyRequest, reply: FastifyReply) => {
    const connections = adapter.getAllConnections();
    const eventLog = adapter.getEventLog();

    return reply.type("text/html").send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YAMA Realtime Inspector</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: #4CAF50;
      margin-bottom: 20px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #2a2a2a;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #3a3a3a;
    }
    .stat-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #4CAF50;
    }
    .section {
      background: #2a2a2a;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid #3a3a3a;
    }
    .section h2 {
      color: #4CAF50;
      margin-bottom: 15px;
      font-size: 18px;
    }
    .event {
      padding: 12px;
      margin: 8px 0;
      background: #1a1a1a;
      border-radius: 4px;
      border-left: 3px solid #4CAF50;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .channel {
      color: #4CAF50;
      font-weight: bold;
    }
    .event-name {
      color: #FFC107;
    }
    .timestamp {
      color: #888;
      font-size: 10px;
    }
    .data {
      color: #e0e0e0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .connection {
      padding: 10px;
      margin: 5px 0;
      background: #1a1a1a;
      border-radius: 4px;
      border-left: 3px solid #2196F3;
      font-size: 12px;
    }
    .connection-id {
      color: #2196F3;
      font-weight: bold;
    }
    .channels {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 5px;
    }
    .channel-tag {
      background: #3a3a3a;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      color: #4CAF50;
    }
    button {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 10px;
    }
    button:hover {
      background: #45a049;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔌 YAMA Realtime Inspector</h1>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Active Connections</div>
        <div class="stat-value" id="connection-count">${connections.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Recent Events</div>
        <div class="stat-value" id="event-count">${eventLog.length}</div>
      </div>
    </div>

    <div class="section">
      <h2>📡 Active Connections</h2>
      <div id="connections">
        ${connections.map(conn => `
          <div class="connection">
            <div class="connection-id">${conn.connectionId}</div>
            ${conn.userId ? `<div style="color: #888; font-size: 11px;">User: ${conn.userId}</div>` : ''}
            <div class="channels">
              ${Array.from(conn.subscribedChannels).map(ch => `<span class="channel-tag">${ch}</span>`).join('')}
            </div>
          </div>
        `).join('')}
        ${connections.length === 0 ? '<div style="color: #888;">No active connections</div>' : ''}
      </div>
    </div>

    <div class="section">
      <h2>📋 Recent Events</h2>
      <button onclick="location.reload()">Refresh</button>
      <div id="events">
        ${eventLog.slice().reverse().map(event => `
          <div class="event">
            <div class="event-header">
              <div>
                <span class="channel">${event.channel}</span>
                <span class="event-name"> → ${event.event}</span>
              </div>
              <span class="timestamp">${new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="data">${JSON.stringify(event.data, null, 2)}</div>
          </div>
        `).join('')}
        ${eventLog.length === 0 ? '<div style="color: #888;">No events yet</div>' : ''}
      </div>
    </div>
  </div>

  <script>
    // Auto-refresh every 2 seconds
    setInterval(() => {
      location.reload();
    }, 2000);
  </script>
</body>
</html>
    `);
  });
}

/**
 * Log event to console (if enabled)
 */
export function logEvent(channel: string, event: string, data: unknown): void {
  console.log(`[Realtime] ${channel} → ${event}`, data);
}

