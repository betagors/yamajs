# @yamajs/realtime-client

Client SDK for connecting to YAMA realtime WebSocket servers.

## Installation

```bash
npm install @yamajs/realtime-client
```

## Usage

### Basic Connection

```typescript
import { createYamaRealtimeClient } from '@yamajs/realtime-client';

const client = createYamaRealtimeClient('ws://localhost:3000/ws', {
  token: 'your-jwt-token',  // Optional: for authentication
  reconnect: true,  // Auto-reconnect on disconnect
  reconnectDelay: 1000,  // Delay between reconnect attempts (ms)
  onError: (error) => {
    console.error('Realtime error:', error);
  },
});

await client.connect();
```

### Entity Events

Subscribe to entity events (automatically published by server):

```typescript
const products = client.entity('Product', ['created', 'updated', 'deleted']);

products.on('created', (product) => {
  console.log('New product:', product);
});

products.on('updated', (product) => {
  console.log('Product updated:', product);
});

products.on('deleted', (data) => {
  console.log('Product deleted:', data.id);
});
```

### Custom Channels

Subscribe to custom channels:

```typescript
// Simple channel
const notifications = client.channel('/notifications');
notifications.on('alert', (data) => {
  console.log('Notification:', data);
});

// Parameterized channel
const chatRoom = client.channel('/chat/:roomId', { roomId: 'general' });
chatRoom.on('message.new', (message) => {
  console.log('New message:', message);
});
```

### Connection Events

Listen to connection events:

```typescript
client.on('connect', () => {
  console.log('Connected to realtime server');
});

client.on('disconnect', () => {
  console.log('Disconnected from realtime server');
});

client.on('error', (error) => {
  console.error('Connection error:', error);
});
```

### Unsubscribing

```typescript
// Unsubscribe from a channel
notifications.off('alert', handler);  // Remove specific handler
notifications.off('alert');  // Remove all handlers for event
notifications.unsubscribe();  // Unsubscribe from channel entirely

// Unsubscribe from entity
products.unsubscribe();
```

### Disconnect

```typescript
client.disconnect();
```

## API Reference

### `YamaRealtimeClient`

- `connect()`: Connect to the server
- `disconnect()`: Disconnect from the server
- `channel(path, params?)`: Get a channel instance
- `entity(name, events?)`: Get an entity subscription
- `on(event, handler)`: Listen to connection events
- `off(event, handler?)`: Remove event listeners
- `isConnected`: Boolean property indicating connection state

### `RealtimeChannel`

- `on(event, handler)`: Subscribe to an event
- `off(event, handler?)`: Unsubscribe from an event
- `unsubscribe()`: Unsubscribe from the channel
- `isSubscribed`: Boolean property indicating subscription state

### `EntitySubscription`

- `on(event, handler)`: Subscribe to an entity event
- `unsubscribe()`: Unsubscribe from all entity events

