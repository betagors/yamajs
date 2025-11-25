# @betagors/yama-core

> Core runtime and types for Yama - backend as config framework

[![npm version](https://img.shields.io/npm/v/@betagors/yama-core.svg)](https://www.npmjs.com/package/@betagors/yama-core)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

The core package provides the foundational runtime, types, and utilities for the Yama framework. It includes schema validation, authentication, type generation, database adapters, HTTP server adapters, and the plugin system.

## Installation

```bash
npm install @betagors/yama-core
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

## Usage

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

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All exports are typed and can be imported with full IntelliSense support.

## Requirements

- Node.js >= 18

## License

MPL-2.0


