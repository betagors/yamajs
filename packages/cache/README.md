# @yamajs/cache

A unified, extensible cache abstraction layer for Yama applications.

## Features

- ✅ **Adapter-agnostic** - Works with Redis, Memcached, Memory, or any backend
- ✅ **Extensible** - Hooks and plugin system for adding features without breaking changes
- ✅ **Namespacing** - Built-in support for key prefixing/partitioning
- ✅ **Type-safe** - Full TypeScript support
- ✅ **YAML Configuration** - Declarative configuration in `yama.yaml`
- ✅ **Memory Adapter** - Built-in in-memory cache for development

## Installation

```bash
pnpm add @yamajs/cache
# Optional: add specific adapters
# pnpm add @yamajs/cache-redis
```

## Quick Start

```typescript
import { Cache, createMemoryAdapter } from '@yamajs/cache';

// Create adapter (or use createRedisAdapter from @yamajs/cache-redis)
const adapter = createMemoryAdapter();

// Create cache instance
const cache = new Cache(adapter);

// Set a value
await cache.set('user:123', { name: 'Alice' }, 3600);

// Get a value
const user = await cache.get('user:123');

// Delete a value
await cache.del('user:123');

// Check existence
const exists = await cache.exists('user:123');
```

## YAML Configuration (Recommended)

Configure cache declaratively in your `yama.yaml`:

```yaml
cache:
  provider: redis
  prefix: my-app:
  defaults:
    ttl: 3600
  options:
    url: redis://localhost:6379
```

Then register the provider and use it:

```typescript
import { registerCacheProvider, createCacheFromConfig } from '@yamajs/cache';
import { createRedisAdapter } from '@yamajs/cache-redis'; // hypothetical package

// Register provider (usually done by plugin)
registerCacheProvider('redis', createRedisAdapter);

// Create cache from config
const cache = createCacheFromConfig(yamaConfig.cache);

// Or with Yama framework, it's automatic!
app.use(async (ctx, next) => {
   // ctx.cache is ready!
   const cached = await ctx.cache.get('foo');
   await next();
});
```

See [YAML_CONFIG.md](./YAML_CONFIG.md) for complete configuration guide.

## Extensibility

### Hooks

Add behavior before/after operations:

```typescript
cache.on('before:set', async ({ key, value }) => {
  console.log(`Setting cache key: ${key}`);
});

cache.on('after:get', async ({ key, result }) => {
  if (!result) {
    console.log(`Cache miss: ${key}`);
  }
});
```

### Extensions

Add new methods via plugins:

```typescript
const compressionPlugin = {
  name: 'compression',
  async setCompressed(key, value) {
    const compressed = await compress(value);
    await this.set(key, compressed);
  }
};

cache.use(compressionPlugin);

// New method available!
await cache.setCompressed('large-data', data);
```

## Core API

The core API is **stable** and will never break:

- `get(key)`
- `set(key, value, ttl?)`
- `del(key)`
- `exists(key)`
- `namespace(prefix)`

## Namespacing

Create isolated views of the cache:

```typescript
const users = cache.namespace('users');
await users.set('123', data); // Key: "users:123" (if prefix was empty)

const posts = cache.namespace('posts');
await posts.set('456', data); // Key: "posts:456"
```
