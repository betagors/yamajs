# @betagors/yama-core

> Core runtime and types for Yama - backend as config framework

[![npm version](https://img.shields.io/npm/v/@betagors/yama-core.svg)](https://www.npmjs.com/package/@betagors/yama-core)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

The core package provides the foundational runtime, types, and utilities for the Yama framework. It includes schema validation, authentication, type generation, database adapters, HTTP server adapters, and the plugin system.

## Installation

```bash
npm install @betagors/yama-core
```

### Deno

```bash
deno add npm:@betagors/yama-core
```

### Bun

```bash
bun add @betagors/yama-core
```

## Features

- **Schema Validation** - JSON Schema validation with AJV
- **Type Generation** - Generate TypeScript types from YAML schemas
- **Authentication** - JWT and API key authentication with authorization rules
- **Database Adapters** - Pluggable database adapter system
- **Cache Adapters** - Unified cache adapter interface for Redis, Memcached, etc.
- **HTTP Server Adapters** - Pluggable HTTP server adapter system
- **Plugin System** - Extensible plugin architecture
- **Migration System** - Database migration utilities and model diffing
- **Entity System** - Convert entities to schemas and manage database models
- **Pagination** - Multiple pagination types (offset, page, cursor) with metadata support

## Usage (runtime-neutral)

The core is runtime-neutral and expects the host to provide web-standard APIs (`fetch`, `URL`, `crypto.subtle`, `ReadableStream`, etc.). Node-specific globals are not required. Platform-specific concerns (fs/path/env/crypto/password hashing) are injected via providers.

### Platform providers

- `setFileSystem`, `setPathModule`: provide minimal fs/path for features that need the file system (migrations, plugins). Node adapter wires these automatically.
- `setEnvProvider`: provide `getEnv`/`setEnv`/`cwd`.
- `setCryptoProvider`, `setPasswordHasher`: override random bytes/ints/timingSafeEqual and password hashing.

If you use `@betagors/yama-node`, these are configured for you. Other runtimes (Deno/Bun/edge) can inject equivalents before calling APIs that need them.

#### Deno adapter example (npm mode)

```ts
import { setFileSystem, setPathModule, setEnvProvider } from "@betagors/yama-core";

setFileSystem({
  readFileSync: (p) => Deno.readTextFileSync(p),
  writeFileSync: (p, data) =>
    Deno.writeTextFileSync(p, typeof data === "string" ? data : new TextDecoder().decode(data)),
  existsSync: (p) => {
    try {
      Deno.statSync(p);
      return true;
    } catch {
      return false;
    }
  },
  mkdirSync: (p, opts) => Deno.mkdirSync(p, { recursive: opts?.recursive }),
  readdirSync: (p) => Array.from(Deno.readDirSync(p)).map((e) => e.name),
  statSync: (p) => Deno.statSync(p),
  unlinkSync: (p) => Deno.removeSync(p),
});

setPathModule({
  join: (...xs) => xs.join("/"),
  dirname: (p) => p.split("/").slice(0, -1).join("/") || "/",
  resolve: (...xs) => xs.join("/"),
});

setEnvProvider({
  getEnv: (k) => Deno.env.get(k),
  setEnv: (k, v) => (v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v)),
  cwd: () => Deno.cwd(),
});
```

#### Bun adapter example

```ts
import { setFileSystem, setPathModule, setEnvProvider } from "@betagors/yama-core";
import fs from "node:fs";
import path from "node:path";

setFileSystem(fs);
setPathModule(path);
setEnvProvider({
  getEnv: (k) => process.env[k],
  setEnv: (k, v) => {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  },
  cwd: () => process.cwd(),
});
```

### Schema Validation

```typescript
import { createSchemaValidator, type YamaSchemas } from '@betagors/yama-core';

const validator = createSchemaValidator();

const schemas: YamaSchemas = {
  User: {
    fields: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      name: { type: 'string' }
    }
  }
};

validator.registerSchemas(schemas);

const result = validator.validate('User', {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'user@example.com',
  name: 'John Doe'
});

if (result.valid) {
  console.log('Valid!');
} else {
  console.error('Validation errors:', result.errors);
}
```

### Authentication

```typescript
import { authenticateAndAuthorize, type AuthConfig } from '@betagors/yama-core';

const authConfig: AuthConfig = {
  providers: [
    {
      type: 'jwt',
      secret: process.env.JWT_SECRET!
    }
  ]
};

const authResult = await authenticateAndAuthorize(
  request.headers,
  authConfig,
  { required: true, roles: ['admin'] }
);

if (authResult.authorized) {
  // Access auth context
  const userId = authResult.context?.userId;
}
```

### Type Generation

```typescript
import { generateTypes } from '@betagors/yama-core';

const types = generateTypes(schemas);
// Returns TypeScript type definitions as a string
```

### Pagination

Yama supports multiple pagination types for flexible API design:

#### Offset Pagination (Default)

```yaml
endpoints:
  - path: /products
    method: GET
    handler:
      type: query
      entity: Product
      pagination:
        type: offset
        limit: query.limit
        offset: query.offset
        metadata: true
```

#### Page-Based Pagination

```yaml
endpoints:
  - path: /products
    method: GET
    handler:
      type: query
      entity: Product
      pagination:
        type: page
        page: query.page
        pageSize: 20
        metadata: [total, hasNext, hasPrev]
```

#### Cursor-Based Pagination

```yaml
endpoints:
  - path: /products
    method: GET
    handler:
      type: query
      entity: Product
      pagination:
        type: cursor
        cursor: query.cursor
        cursorField: id
        limit: 20
        metadata: [hasNext, nextCursor]
      orderBy:
        field: id
        direction: asc
```

#### Shorthand Configuration

```yaml
# Enable pagination with defaults (offset, limit=20)
pagination: true

# Or specify type with smart defaults
pagination:
  type: page  # pageSize defaults to 20
```

#### Pagination Metadata

All paginated responses are automatically wrapped with metadata for better DX:

```typescript
// Always wrapped with metadata
{
  data: [/* array of results */],
  pagination: {
    type: "page",
    page: 1,
    pageSize: 20,
    hasNext: true,
    hasPrev: false
  }
}
```

You can specify which metadata fields to include:

```yaml
pagination:
  type: page
  metadata: [total, hasNext, hasPrev]  # Only include these fields
```

Available metadata fields:
- `total` - Total count of items (requires COUNT query)
- `hasNext` - Boolean indicating if more results exist
- `hasPrev` - Boolean indicating if previous page exists
- `nextCursor` - Next cursor token (cursor pagination)
- `prevCursor` - Previous cursor token (cursor pagination)

#### Programmatic Usage

```typescript
import {
  normalizePaginationConfig,
  calculatePaginationMetadata,
  wrapPaginatedResponse,
  type PaginationConfig
} from '@betagors/yama-core';

// Normalize pagination config from YAML
const normalized = normalizePaginationConfig(
  { type: 'page', page: 1, pageSize: 20 },
  context,
  'id', // primary key field
  20    // default limit
);

// Calculate metadata after fetching results
const metadata = calculatePaginationMetadata(
  normalized,
  results,
  totalCount // optional
);

// Wrap response with metadata
const response = wrapPaginatedResponse(
  results,
  metadata,
  true // include all metadata
);
```

### Database Adapters

```typescript
import { createDatabaseAdapter, type DatabaseConfig } from '@betagors/yama-core';

const dbConfig: DatabaseConfig = {
  dialect: 'postgresql',
  url: process.env.DATABASE_URL!
};

const adapter = createDatabaseAdapter('postgresql', dbConfig);
await adapter.init(dbConfig);

// Use adapter methods
const result = await adapter.query('SELECT * FROM users');
```

### HTTP Server Adapters

```typescript
import { createHttpServerAdapter, type RouteHandler } from '@betagors/yama-core';

const adapter = createHttpServerAdapter('fastify', {});
const server = adapter.createServer({});

// RouteHandler is used by adapters (takes request/reply)
const handler: RouteHandler = async (request, reply) => {
  return { message: 'Hello, Yama!' };
};

adapter.registerRoute(server, 'GET', '/hello', handler);
await adapter.start(server, 3000, '0.0.0.0');
```

### Cache Adapters

The cache adapter interface provides a unified API for cache operations. Cache adapters are typically provided via plugins (e.g., `@betagors/yama-redis`).

```typescript
import { type CacheAdapter } from '@betagors/yama-core';

// Cache adapters are available in HandlerContext
export async function myHandler(context: HandlerContext) {
  // Get from cache
  const cached = await context.cache?.get<string>('user:42');
  
  if (!cached) {
    // Fetch and cache
    const user = await fetchUser(42);
    await context.cache?.set('user:42', user, 3600); // 1 hour TTL
    return user;
  }
  
  return cached;
}
```

**Cache Adapter Methods:**
- `get<T>(key: string)` - Get a value from cache
- `set<T>(key: string, value: T, ttlSeconds?: number)` - Set a value in cache
- `del(key: string)` - Delete a key from cache
- `exists(key: string)` - Check if a key exists
- `namespace(prefix: string)` - Create a namespaced cache adapter
- `health?()` - Optional health check method

**Namespace Support:**
```typescript
// Create isolated cache namespace
const tenantCache = context.cache?.namespace('tenant:123');
await tenantCache?.set('user:42', userData); // Stores as "tenant:123:user:42"
```

### Rate Limiting

Yama provides configurable rate limiting with automatic Redis optimization:

```typescript
import { createRateLimiterFromConfig, type RateLimitConfig } from '@betagors/yama-core';

const config: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  store: 'cache', // Uses cache adapter
  onFailure: 'fail-closed' // Deny when cache is down
};

const limiter = await createRateLimiterFromConfig(config, cacheAdapter);
```

**Performance:**
- **Redis**: Automatically uses optimized sorted sets (atomic, no race conditions)
- **Other caches**: Uses GET + SET operations (may have race conditions under high concurrency)
- **Memory**: Fast, single-instance only

**Fail Modes:**
- `fail-open` (default): Allow requests when cache fails (graceful degradation)
- `fail-closed`: Deny requests when cache fails (more secure)

See [rate-limit/README.md](./src/rate-limit/README.md) for detailed documentation.

### Handler Functions (User Handlers)

User handlers use `HandlerFunction` with `HandlerContext`:

```typescript
import { type HandlerContext } from '@betagors/yama-core';

export async function myHandler(context: HandlerContext) {
  // Access request data
  const id = context.params.id;
  const query = context.query;
  const body = context.body;
  
  // Access auth context
  const user = context.auth?.user;
  
  // Access cache (if cache plugin is loaded)
  const cached = await context.cache?.get<string>('key');
  if (!cached) {
    await context.cache?.set('key', 'value', 3600);
  }
  
  // Set status code (optional)
  context.status(201);
  
  // Return response
  return { id, message: 'Success' };
}
```

### Plugin System

```typescript
import { loadPlugin, type YamaPlugin } from '@betagors/yama-core';

const plugin = await loadPlugin('@betagors/yama-postgres');
const pluginApi = await plugin.init({
  url: process.env.DATABASE_URL!
});
```

### Entity System

```typescript
import { entitiesToSchemas, type YamaEntities } from '@betagors/yama-core';

const entities: YamaEntities = {
  User: {
    fields: {
      id: { type: 'uuid', primaryKey: true },
      email: { type: 'string', unique: true },
      name: { type: 'string' }
    }
  }
};

const schemas = entitiesToSchemas(entities);
// Converts entities to schemas for validation
```

## API Reference

### Schema Validation

- `createSchemaValidator()` - Create a new schema validator instance
- `SchemaValidator` - Schema validator class
- `schemaToJsonSchema()` - Convert Yama schema to JSON Schema
- `fieldToJsonSchema()` - Convert a field definition to JSON Schema

### Authentication

- `authenticateRequest()` - Authenticate a request
- `authorizeRequest()` - Authorize a request
- `authenticateAndAuthorize()` - Authenticate and authorize in one call

### Type Generation

- `generateTypes()` - Generate TypeScript types from schemas

### Database Adapters

- `createDatabaseAdapter()` - Create a database adapter
- `registerDatabaseAdapter()` - Register a custom database adapter
- `DatabaseAdapter` - Database adapter interface

### HTTP Server Adapters

- `createHttpServerAdapter()` - Create an HTTP server adapter
- `registerHttpServerAdapter()` - Register a custom HTTP server adapter
- `HttpServerAdapter` - HTTP server adapter interface

### Cache Adapters

- `CacheAdapter` - Cache adapter interface
- Cache adapters are provided via plugins (e.g., `@betagors/yama-redis`)
- Available in `HandlerContext.cache` when a cache plugin is loaded

### Rate Limiting

- `createRateLimiterFromConfig()` - Create rate limiter from configuration
- `createRateLimiter()` - Create rate limiter with custom store
- `formatRateLimitHeaders()` - Format rate limit headers (RFC 6585)
- `RateLimitConfig` - Rate limit configuration type
- `RateLimiter` - Rate limiter interface
- `RateLimitStore` - Rate limit store interface
- Automatically optimizes for Redis (uses sorted sets)
- Supports fail-open and fail-closed modes

### Plugin System

- `loadPlugin()` - Load a plugin by name
- `getPlugin()` - Get a loaded plugin
- `getAllPlugins()` - Get all loaded plugins
- `getPluginByCategory()` - Get plugin by category
- `loadPluginFromPackage()` - Load plugin from npm package

### Migration System

- `entitiesToModel()` - Convert entities to database model
- `compareModels()` - Compare two database models
- `computeDiff()` - Compute differences between models
- `diffToSteps()` - Convert diff to migration steps
- `createMigration()` - Create a migration from steps
- `serializeMigration()` - Serialize migration to YAML
- `deserializeMigration()` - Deserialize migration from YAML
- `validateMigration()` - Validate a migration
- `replayMigrations()` - Replay migrations on a database

### Pagination

- `normalizePaginationConfig()` - Normalize pagination config to standard form
- `pageToOffset()` - Convert page/pageSize to offset/limit
- `calculatePaginationMetadata()` - Calculate pagination metadata from results
- `wrapPaginatedResponse()` - Wrap results with pagination metadata
- `detectPaginationFromQuery()` - Detect pagination type from query parameters
- `PaginationConfig` - Pagination configuration type
- `PaginationMetadata` - Pagination metadata type
- `PaginatedResponse` - Paginated response wrapper type

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All exports are typed and can be imported with full IntelliSense support.

## Requirements

- Node.js >= 18

## License

MPL-2.0


