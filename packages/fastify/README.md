# @betagors/yama-fastify

> Fastify HTTP server adapter for Yama

[![npm version](https://img.shields.io/npm/v/@betagors/yama-fastify.svg)](https://www.npmjs.com/package/@betagors/yama-fastify)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

HTTP server adapter that integrates [Fastify](https://www.fastify.io/) with the Yama framework. This adapter allows Yama to use Fastify as its HTTP server engine.

## Installation

```bash
npm install @betagors/yama-fastify fastify
```

## Usage

The adapter is typically used internally by `@betagors/yama-node`, but you can also use it directly:

```typescript
import { createFastifyAdapter } from '@betagors/yama-fastify';
import { createHttpServerAdapter } from '@betagors/yama-core';

// Register the Fastify adapter
registerHttpServerAdapter('fastify', (options) => 
  createFastifyAdapter(options)
);

// Create and use the adapter
const adapter = createHttpServerAdapter('fastify', {
  // Fastify options
  logger: true
});

const server = adapter.createServer({});

// Register routes
adapter.registerRoute(server, 'GET', '/hello', async (request, reply) => {
  return { message: 'Hello from Fastify!' };
});

// Start server
await adapter.start(server, 3000, '0.0.0.0');
```

## Integration with Yama Runtime

When using `@betagors/yama-node`, the Fastify adapter is automatically registered and used. You don't need to manually set it up:

```yaml
# yama.yaml
server:
  engine: fastify
  options:
    logger: true
```

## Fastify Options

You can pass any Fastify options through the adapter:

```typescript
const adapter = createHttpServerAdapter('fastify', {
  logger: {
    level: 'info'
  },
  bodyLimit: 1048576,
  // ... other Fastify options
});
```

## Requirements

- Node.js >= 18
- Fastify >= 5.0.0

## License

MPL-2.0


