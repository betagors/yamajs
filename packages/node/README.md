# @betagors/yama-node

> Node.js runtime adapter for Yama

[![npm version](https://img.shields.io/npm/v/@betagors/yama-node.svg)](https://www.npmjs.com/package/@betagors/yama-node)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

Node.js runtime adapter that provides a complete runtime environment for Yama applications. This package integrates all the pieces needed to run a Yama API server, including HTTP server, database adapters, plugin loading, and handler execution.

## Installation

```bash
npm install @betagors/yama-node
```

## Usage

### Basic Usage

```typescript
import { startYamaNodeRuntime } from '@betagors/yama-node';

// Start the runtime with a yama.yaml config file
const server = await startYamaNodeRuntime(
  3000,                    // Port
  './yama.yaml',          // Config file path
  'development'           // Environment (optional)
);

console.log(`Server running on port ${server.port}`);

// Stop the server
await server.stop();
```

### Without Config File

You can also start the runtime without a config file (useful for programmatic usage):

```typescript
const server = await startYamaNodeRuntime(3000);
// Server will start with minimal configuration
```

### With Environment Variables

The runtime automatically loads `.env` files based on the environment:

```bash
# .env.development
DATABASE_URL=postgresql://localhost:5432/mydb
JWT_SECRET=your-secret-key
```

```typescript
const server = await startYamaNodeRuntime(
  3000,
  './yama.yaml',
  'development'  // Loads .env.development
);
```

## Features

### Automatic Plugin Loading

The runtime automatically loads and initializes plugins specified in `yama.yaml`:

```yaml
# yama.yaml
plugins:
  - @betagors/yama-postgres
  - @betagors/yama-fastify
```

### Handler Loading

Handlers are automatically loaded from `src/handlers/`:

```typescript
// src/handlers/listTodos.ts
import { HandlerContext } from '@betagors/yama-core';

export async function listTodos(context: HandlerContext) {
  return [
    { id: '1', title: 'Todo 1', completed: false }
  ];
}
```

### Built-in Routes

The runtime provides several built-in routes:

- `GET /health` - Health check endpoint
- `GET /config` - Current configuration
- `GET /openapi.json` - OpenAPI specification
- `GET /docs` - Interactive API documentation (Swagger UI)

### Request Validation

All requests are automatically validated based on your `yama.yaml` configuration:

```yaml
endpoints:
  - path: /todos
    method: POST
    body:
      type: Todo
    response:
      type: Todo
```

### Authentication & Authorization

JWT and API key authentication is handled automatically:

```yaml
auth:
  providers:
    - type: jwt
      secret: ${JWT_SECRET}

endpoints:
  - path: /admin/users
    method: GET
    auth:
      required: true
      roles: ['admin']
```

## Configuration

The runtime reads configuration from `yama.yaml`:

```yaml
name: my-api
version: 1.0.0

server:
  engine: fastify
  options:
    logger: true

plugins:
  - @betagors/yama-postgres
  - @betagors/yama-redis:
      url: redis://localhost:6379

database:
  url: ${DATABASE_URL}

auth:
  providers:
    - type: jwt
      secret: ${JWT_SECRET}

schemas:
  Todo:
    fields:
      id: { type: string, format: uuid }
      title: { type: string }
      completed: { type: boolean }

endpoints:
  - path: /todos
    method: GET
    handler: listTodos
    response:
      type: list
      items: Todo
```

## Handler Context

Handlers receive a single `HandlerContext` parameter with request information and framework services:

```typescript
import { HandlerContext } from '@betagors/yama-core';

export async function myHandler(context: HandlerContext) {
  // Access authenticated user
  const userId = context.auth?.user?.id;
  
  // Access path parameters
  const id = context.params.id;
  
  // Access query parameters
  const page = context.query.page;
  
  // Access request body
  const data = context.body;
  
  // Access cache (if cache plugin is loaded)
  const cacheKey = `user:${id}`;
  let user = await context.cache?.get<User>(cacheKey);
  if (!user) {
    // Fetch from database
    user = await fetchUser(id);
    // Cache for 1 hour
    await context.cache?.set(cacheKey, user, 3600);
  }
  
  // Set response status (optional - framework sets defaults)
  context.status(201);
  
  // Return response data (framework handles sending)
  return { success: true, user };
}
```

## Error Handling

The runtime automatically handles errors and returns appropriate HTTP status codes:

- `400` - Validation errors
- `401` - Authentication errors
- `403` - Authorization errors
- `500` - Internal server errors

## Requirements

- Node.js >= 18

## Dependencies

This package depends on:
- `@betagors/yama-core` - Core runtime
- `@betagors/yama-openapi` - OpenAPI generation
- `@betagors/yama-postgres` - PostgreSQL adapter (or other database adapter)
- `@betagors/yama-fastify` - Fastify HTTP adapter
- `js-yaml` - YAML parsing
- `dotenv` - Environment variable loading

## License

MPL-2.0


