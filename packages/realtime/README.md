# @yamajs/realtime

Yama realtime/WebSocket plugin for enabling realtime features in your YAMA applications.

## Installation

```bash
npm install @yamajs/realtime @fastify/websocket
```

## Configuration

Add the plugin to your `yama.yaml`:

```yaml
plugins:
  "@yamajs/realtime":
    path: /ws  # WebSocket endpoint path (default: /ws)
    redis: true  # Use Redis for pub/sub (optional, uses cache if available)
    dev:
      logEvents: true  # Console log all events in dev mode
      inspectorUI: true  # Mount inspector at /realtime-inspector

realtime:
  # Entity-based automatic events
  entities:
    Product:
      enabled: true
      events: [created, updated, deleted]
      watchFields: [name, price]  # Only emit updates when these fields change
  
  # Custom channels
  channels:
    - name: notifications
      path: /notifications
      auth:
        required: true
    
    - name: chat
      path: /chat/:roomId
      auth:
        required: true
      params:
        roomId:
          type: string
          required: true
```

## Usage

### Server-side

In your handlers, use `context.realtime`:

```typescript
import type { HandlerContext } from '@yamajs/core';

export async function createProduct(context: HandlerContext) {
  const product = await context.entities.Product.create(context.body);
  
  // Publish realtime event
  await context.realtime?.publish('product:created', 'created', product);
  
  return product;
}

// Fire-and-forget (doesn't throw on error)
context.realtime?.publishAsync('notifications', 'alert', {
  message: 'New product added',
  productId: product.id,
});

// Send to specific user
await context.realtime?.publish('notifications', 'alert', data, {
  userId: context.auth.user.id
});
```

### Entity Events

When `realtime.enabled: true` is set on an entity, events are automatically published:

- `entity:created` - When an entity is created
- `entity:updated` - When an entity is updated
- `entity:deleted` - When an entity is deleted

## Client SDK

Use `@yamajs/realtime-client` for client-side connections:

```typescript
import { createYamaRealtimeClient } from '@yamajs/realtime-client';

const client = createYamaRealtimeClient('ws://localhost:3000/ws', {
  token: 'your-jwt-token',
  reconnect: true,
});

await client.connect();

// Subscribe to entity events
const products = client.entity('Product', ['created', 'updated']);
products.on('created', (product) => {
  console.log('New product:', product);
});

// Subscribe to custom channels
const notifications = client.channel('/notifications');
notifications.on('alert', (data) => {
  console.log('Notification:', data);
});
```

## Development Tools

When `dev.inspectorUI: true` is enabled, visit `/realtime-inspector` to see:
- Active connections
- Recent events
- Channel subscriptions

## Redis Pub/Sub

If Redis cache plugin is available, the realtime plugin automatically uses it for distributed pub/sub, enabling horizontal scaling across multiple server instances.

