# @betagors/yama-pglite

> PGLite database adapter for Yama

[![npm version](https://img.shields.io/npm/v/@betagors/yama-pglite.svg)](https://www.npmjs.com/package/@betagors/yama-pglite)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

PGLite database adapter for Yama that provides an in-memory PostgreSQL-compatible database using [PGLite](https://github.com/electric-sql/pglite). Perfect for development, testing, and serverless environments.

## Installation

```bash
npm install @betagors/yama-pglite drizzle-orm @electric-sql/pglite
```

## Usage

### As a Plugin

The recommended way to use this adapter is as a Yama plugin in your `yama.yaml`:

```yaml
# yama.yaml
plugins:
  - @betagors/yama-pglite

# Or with configuration:
plugins:
  @betagors/yama-pglite:
    dataDir: ./data  # Optional: persist data to disk
```

### Programmatic Usage

```typescript
import plugin from '@betagors/yama-pglite';

// Initialize the plugin (in-memory by default)
const pluginApi = await plugin.init({});

// Or with persistence
const pluginApi = await plugin.init({
  dataDir: './data'
});

// Access the adapter
const adapter = pluginApi.adapter;

// Use database methods
const result = await adapter.query('SELECT * FROM users');
```

### Direct Adapter Usage

```typescript
import { pgliteAdapter } from '@betagors/yama-pglite';
import { createDatabaseAdapter } from '@betagors/yama-core';

// Register the adapter
registerDatabaseAdapter('pglite', pgliteAdapter);

// Create and use the adapter
const adapter = createDatabaseAdapter('pglite', {
  dataDir: './data'  // Optional
});

await adapter.init({});
```

## Features

### In-Memory Database

PGLite runs PostgreSQL in WebAssembly, providing a fully compatible PostgreSQL database that runs entirely in memory. No external database server required!

```typescript
// No configuration needed - works out of the box
const adapter = createDatabaseAdapter('pglite', {});
await adapter.init({});

// Use it just like PostgreSQL
await adapter.query('CREATE TABLE users (id UUID PRIMARY KEY, name TEXT)');
await adapter.query('INSERT INTO users VALUES ($1, $2)', [
  '123e4567-e89b-12d3-a456-426614174000',
  'John Doe'
]);
```

### Data Persistence

Optionally persist data to disk:

```typescript
const adapter = createDatabaseAdapter('pglite', {
  dataDir: './data'  // Data will be persisted to this directory
});

await adapter.init({
  dataDir: './data'
});
```

### Drizzle Schema Generation

```typescript
import { generateDrizzleSchema } from '@betagors/yama-pglite';

const schema = generateDrizzleSchema(entities);
// Returns Drizzle schema definitions
```

### Migrations

PGLite supports the same migration system as PostgreSQL:

```typescript
import { generateSQLFromSteps } from '@betagors/yama-pglite';

const sql = generateSQLFromSteps(steps, 'pglite');
```

## Use Cases

- **Development** - Fast, no-setup database for local development
- **Testing** - Isolated database instances for unit and integration tests
- **Serverless** - In-memory database for serverless functions
- **Demos** - Quick prototypes and demos without database setup

## Limitations

- Data is lost when the process exits (unless using `dataDir`)
- Not suitable for production workloads requiring high availability
- Limited to single-process usage
- Some PostgreSQL features may not be fully supported

## Requirements

- Node.js >= 18
- drizzle-orm >= 0.30.0
- @electric-sql/pglite >= 0.2.0

## License

MPL-2.0


