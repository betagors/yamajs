# @betagors/yama-redis

Redis cache adapter plugin for Yama.

## Installation

```bash
npm install @betagors/yama-redis ioredis
# or
npm install @betagors/yama-redis redis
```

You need to install either `ioredis` or `redis` package as a peer dependency.

## Configuration

Add the plugin to your `yama.yaml`:

```yaml
plugins:
  "@betagors/yama-redis":
    url: redis://localhost:6379
    # or
    host: localhost
    port: 6379
    password: optional
    db: 0
```

### Configuration Options

- `url` - Redis connection URL (e.g., `redis://localhost:6379`)
- `host` - Redis host (default: `localhost`)
- `port` - Redis port (default: `6379`)
- `password` - Redis password (optional)
- `db` - Redis database number (optional)

Any additional options will be passed to the Redis client.

## Usage

Once the plugin is loaded, the cache adapter is available in handler context:

```typescript
import type { HandlerContext } from '@betagors/yama-core';

export async function myHandler(context: HandlerContext) {
  // Check cache
  const cached = await context.cache?.get<string>('user:42');
  
  if (!cached) {
    // Fetch from database
    const user = await fetchUser(42);
    
    // Cache for 1 hour
    await context.cache?.set('user:42', user, 3600);
    return user;
  }
  
  return cached;
}
```

## Cache Operations

### Get

```typescript
const value = await context.cache?.get<string>('key');
```

### Set

```typescript
// Set without expiration
await context.cache?.set('key', value);

// Set with TTL (time-to-live in seconds)
await context.cache?.set('key', value, 3600); // 1 hour
```

### Delete

```typescript
await context.cache?.del('key');
```

### Exists

```typescript
const exists = await context.cache?.exists('key');
```

### Namespace

Create a namespaced cache adapter for multi-tenancy or feature isolation:

```typescript
const tenantCache = context.cache?.namespace('tenant:123');
await tenantCache?.set('user:42', userData); // Actually stores as "tenant:123:user:42"
```

### Health Check

```typescript
const health = await context.cache?.health();
// { ok: true, latency: 5 } or { ok: false }
```

## Features

- **Type-safe**: Full TypeScript support with generics
- **Automatic serialization**: Values are automatically JSON serialized/deserialized
- **TTL support**: Set expiration times for cached values
- **Namespace support**: Create isolated cache namespaces
- **Health checks**: Monitor cache connection health
- **Multiple Redis clients**: Supports both `ioredis` and `redis` packages

## License

MPL-2.0

