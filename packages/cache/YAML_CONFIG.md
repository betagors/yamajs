# Cache YAML Configuration Guide

## Overview

`@yamajs/cache` supports declarative configuration in `yama.yaml`, following the same pattern as `database` and `storage`.

## Configuration Format

```yaml
# yama.yaml

cache:
  # Provider name (redis, memory, memcached, etc.)
  provider: redis
  
  # Global key prefix (optional)
  prefix: my-app:
  
  # Default options (optional)
  defaults:
    ttl: 3600 # Default TTL in seconds
  
  # Provider-specific options
  options:
    url: redis://localhost:6379
    password: ${REDIS_PASSWORD}
    db: 0
```

## Provider Registration

Before using cache from YAML config, you need to register the provider adapters.

```typescript
// app/init.ts
import { registerCacheProvider } from '@yamajs/cache';
import { createRedisAdapter } from '@yamajs/redis';

// Register available providers
registerCacheProvider('redis', createRedisAdapter);
// 'memory' is registered by default
```

## Usage with Yama Framework

If you're using the Yama framework, cache is automatically initialized from config and added to context.

```typescript
// yama.yaml
plugins:
  - "@yamajs/redis" # Should auto-register 'redis' provider

cache:
  provider: redis
  options: 
    url: ${REDIS_URL}
```

```typescript
// Usage in app
app.get('/data', async (ctx) => {
  const key = 'data:1';
  let data = await ctx.cache.get(key);
  
  if (!data) {
    data = await db.getData();
    await ctx.cache.set(key, data, 300); // Cache for 5 mins
  }
  
  ctx.body = data;
});
```

## Configuration Examples

### In-Memory (Dev/Test)

```yaml
cache:
  provider: memory
  prefix: dev:
  defaults:
    ttl: 60
```

### Redis

```yaml
cache:
  provider: redis
  options:
    host: localhost
    port: 6379
    password: ${REDIS_PASSWORD}
```

### Memcached (Hypothetical)

```yaml
cache:
  provider: memcached
  options:
    hosts: 
      - localhost:11211
```

## Environment Variables

Use `${VAR}` syntax for secrets:

```yaml
cache:
  provider: redis
  options:
    url: ${REDIS_URL}
```
