# @betagors/yama-postgres

> PostgreSQL database adapter for Yama

[![npm version](https://img.shields.io/npm/v/@betagors/yama-postgres.svg)](https://www.npmjs.com/package/@betagors/yama-postgres)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

PostgreSQL database adapter for Yama that provides database connectivity, migrations, schema generation, and data snapshots using [Drizzle ORM](https://orm.drizzle.team/) and the [postgres](https://github.com/porsager/postgres) driver.

## Installation

```bash
npm install @betagors/yama-postgres drizzle-orm postgres
```

## Usage

### As a Plugin

The recommended way to use this adapter is as a Yama plugin in your `yama.yaml`:

```yaml
# yama.yaml
plugins:
  - @betagors/yama-postgres

# Or with configuration:
plugins:
  @betagors/yama-postgres:
    url: ${DATABASE_URL}
```

### Programmatic Usage

```typescript
import plugin from '@betagors/yama-postgres';

// Initialize the plugin
const pluginApi = await plugin.init({
  url: process.env.DATABASE_URL!
});

// Access the adapter
const adapter = pluginApi.adapter;

// Use database methods
const result = await adapter.query('SELECT * FROM users');
```

### Direct Adapter Usage

```typescript
import { postgresqlAdapter } from '@betagors/yama-postgres';
import { createDatabaseAdapter } from '@betagors/yama-core';

// Register the adapter
registerDatabaseAdapter('postgresql', postgresqlAdapter);

// Create and use the adapter
const adapter = createDatabaseAdapter('postgresql', {
  url: process.env.DATABASE_URL!
});

await adapter.init({
  url: process.env.DATABASE_URL!
});
```

## Features

### Database Client

```typescript
import { initDatabase, getDatabase, closeDatabase } from '@betagors/yama-postgres';

await initDatabase({
  url: process.env.DATABASE_URL!
});

const db = getDatabase();
const users = await db.query('SELECT * FROM users');

await closeDatabase();
```

### Drizzle Schema Generation

```typescript
import { generateDrizzleSchema } from '@betagors/yama-postgres';

const schema = generateDrizzleSchema(entities);
// Returns Drizzle schema definitions
```

### Migrations

```typescript
import {
  generateMigrationSQL,
  generateMigrationFile,
  generateSQLFromSteps
} from '@betagors/yama-postgres';

// Generate SQL from migration steps
const sql = generateSQLFromSteps(steps, 'postgresql');

// Generate and save migration file
await generateMigrationFile(steps, 'migrations', '001_initial_schema');
```

### Data Snapshots

```typescript
import {
  createDataSnapshot,
  restoreFromSnapshot,
  listSnapshots,
  deleteSnapshot
} from '@betagors/yama-postgres';

// Create a snapshot
const snapshotId = await createDataSnapshot('users', {
  url: process.env.DATABASE_URL!
});

// List all snapshots
const snapshots = await listSnapshots({
  url: process.env.DATABASE_URL!
});

// Restore from snapshot
await restoreFromSnapshot(snapshotId, {
  url: process.env.DATABASE_URL!
});

// Delete snapshot
await deleteSnapshot(snapshotId, {
  url: process.env.DATABASE_URL!
});
```

## Configuration

The adapter accepts the following configuration options:

```typescript
{
  url: string;              // PostgreSQL connection URL
  host?: string;            // Database host
  port?: number;            // Database port
  database?: string;        // Database name
  user?: string;            // Database user
  password?: string;        // Database password
  ssl?: boolean | object;   // SSL configuration
  // ... other postgres.js options
}
```

## Requirements

- Node.js >= 18
- PostgreSQL database
- drizzle-orm >= 0.30.0
- postgres >= 3.4.3

## License

MPL-2.0


