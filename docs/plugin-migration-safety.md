# Plugin Migration & Update System - Phase 1 Implementation

## Overview

This document describes the Phase 1 implementation of the Plugin Migration & Update System for Yama. This phase focuses on the core safety features needed for production use.

## What's Implemented (Phase 1)

### 1. Migration Lock (`migration-lock.ts`)

**Purpose:** Prevents concurrent migrations from multiple processes.

**Features:**
- Uses PostgreSQL `pg_advisory_lock` for distributed locking
- Falls back to in-memory locks for non-PostgreSQL databases
- Configurable timeout and retry intervals
- Session-level or transaction-level locking options

**Usage:**
```typescript
import { MigrationLock, withMigrationLock } from "@yamajs/core";

// Using withMigrationLock helper
await withMigrationLock(db, "@yamajs/plugin-stripe", async () => {
  await runMigrations();
});

// Or manually
const lock = new MigrationLock(db, "@yamajs/plugin-stripe");
await lock.acquire();
try {
  await runMigrations();
} finally {
  await lock.release();
}
```

### 2. Migration Safety Analysis (`migration-safety.ts`)

**Purpose:** Detects destructive operations in migration SQL and warns users before execution.

**Detected Operations:**
| Type | Severity | Reversible | Example |
|------|----------|------------|---------|
| `DROP_TABLE` | danger | ❌ | `DROP TABLE users;` |
| `DROP_COLUMN` | danger | ❌ | `ALTER TABLE users DROP COLUMN email;` |
| `DROP_DATABASE` | danger | ❌ | `DROP DATABASE mydb;` |
| `TRUNCATE` | danger | ❌ | `TRUNCATE TABLE logs;` |
| `DELETE_ALL` | danger | ❌ | `DELETE FROM sessions;` |
| `ALTER_TYPE` | warning | ❌ | `ALTER TABLE users ALTER COLUMN age TYPE BIGINT;` |
| `DROP_INDEX` | warning | ✅ | `DROP INDEX idx_users_email;` |
| `DROP_CONSTRAINT` | warning | ✅ | `ALTER TABLE users DROP CONSTRAINT fk_order;` |
| `RENAME_COLUMN` | warning | ✅ | `ALTER TABLE users RENAME COLUMN old TO new;` |

**Risk Levels:**
- `low` - No destructive operations
- `medium` - Warnings only (reversible operations)
- `high` - 1+ danger operations
- `critical` - 3+ danger operations or 2+ irreversible operations

**Usage:**
```typescript
import { analyzeMigrationSafety, formatSafetyAnalysis } from "@yamajs/core";

const sql = `
  DROP TABLE old_users;
  ALTER TABLE products ADD COLUMN price DECIMAL;
`;

const analysis = analyzeMigrationSafety(sql);
console.log(analysis.riskLevel);      // "high"
console.log(analysis.requiresBackup); // true

// Human-readable output
console.log(formatSafetyAnalysis(analysis));
```

### 3. Transactional Migration Runner (`migration-runner.ts`)

**Purpose:** Executes migrations atomically with transaction support.

**Features:**
- Wraps migrations in database transactions (PostgreSQL)
- Automatic rollback on failure
- Integrates with safety analysis
- Calls plugin lifecycle hooks (onBeforeMigrate, onAfterMigrate, onMigrationError)
- Dry-run mode for testing
- Force mode for unattended execution

**Usage:**
```typescript
import { MigrationRunner, runPluginMigrations, dryRunMigrations } from "@yamajs/core";

// Using the class
const runner = new MigrationRunner(db, {
  transactional: true,
  dryRun: false,
  force: false,
  logger: {
    info: (msg) => console.log(msg),
    warn: (msg) => console.warn(msg),
    error: (msg) => console.error(msg),
  },
});

const result = await runner.run(plugin, manifest, migrations, pluginDir);

if (result.success) {
  console.log(`Ran ${result.migrationsRun} migrations`);
} else if (result.failedMigration) {
  console.error(`Failed at ${result.failedMigration.version}`);
  if (result.rolledBack) {
    console.log("Transaction was rolled back");
  }
}

// Or use convenience functions
const result = await runPluginMigrations(db, plugin, manifest, migrations, pluginDir);
const preview = await dryRunMigrations(db, plugin, manifest, migrations, pluginDir);
```

### 4. Updated CLI Command (`plugin-migrate.ts`)

**Improvements:**
- Shows safety analysis before running migrations
- Prompts for confirmation on destructive operations
- Displays affected tables and risk level
- Supports `--force` flag for unattended execution
- Supports `--dry-run` for previewing
- Transaction-based execution with rollback on failure

**CLI Experience:**
```bash
$ yama plugin migrate

Checking @yamajs/plugin-auth...
  Current version: 1.0.0
  Target version: 2.0.0

  🔶 HIGH RISK

  Destructive Operations:
    🔴 DROP_COLUMN: users (IRREVERSIBLE)
       Dropping column "legacy_password" from table "users" will delete column data

  Warnings:
    ⚠️  Columns will be dropped and data will be lost

  Affected Tables: users

  📦 Recommendation: Create a backup before proceeding

  ⚠️  Type "DROP_COLUMN users" to confirm: _
```

## How It Works

### Migration Lifecycle

```
1. Load pending migrations
   ↓
2. Analyze SQL for destructive operations
   ↓
3. Calculate risk level (low/medium/high/critical)
   ↓
4. Prompt user if requiresConfirmation
   ↓
5. Acquire migration lock
   ↓
6. BEGIN TRANSACTION
   ↓
7. For each migration:
   ├─ Call onBeforeMigrate hook
   ├─ Execute SQL
   ├─ Record in _yama_plugin_migrations
   └─ Call onAfterMigrate hook
   ↓
8. Update _yama_plugin_versions
   ↓
9. COMMIT (or ROLLBACK on error)
   ↓
10. Release lock
```

### Integration with Plugin Registry

The `PluginRegistry.loadPlugin()` method now uses `MigrationRunner` for automatic migrations during plugin loading:

```typescript
// In registry.ts
const runner = new MigrationRunner(sql, {
  transactional: true,
  force: true,  // Auto-approve during plugin load
});

const result = await runner.run(plugin, manifest, pending, packageDir);
```

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/plugins/migration-lock.ts` | **NEW** - Lock system |
| `packages/core/src/plugins/migration-safety.ts` | **NEW** - Safety analysis |
| `packages/core/src/plugins/migration-runner.ts` | **NEW** - Transaction runner |
| `packages/core/src/plugins/migration-lock.test.ts` | **NEW** - Lock tests |
| `packages/core/src/plugins/migration-safety.test.ts` | **NEW** - Safety tests |
| `packages/core/src/plugins/index.ts` | Updated exports |
| `packages/core/src/plugins/registry.ts` | Uses new runner |
| `packages/cli/src/commands/plugin-migrate.ts` | Safety prompts |
| `packages/cli/src/utils/interactive.ts` | Added promptInput |

## Phase 2 Roadmap

The following features are planned for Phase 2:

1. **Table Prefix Sandboxing** - Plugins can only access their own tables
2. **Automatic Backups** - `pg_dump` affected tables before destructive ops
3. **Migration Validation** - Post-migration checks
4. **Dry-run Mode** - Full preview without execution

## Phase 3 Roadmap

1. **Permission System** - Explicit grants for database access
2. **Full SQL Parsing** - AST-based safety analysis
3. **Migration History UI** - Visual timeline of migrations
4. **Automatic Rollback** - One-click restore to previous state

## Testing

Run the tests:
```bash
cd packages/core
pnpm test -- src/plugins/migration-safety.test.ts
pnpm test -- src/plugins/migration-lock.test.ts
```

## Example Migration Definition

```javascript
// @yamajs/plugin-stripe/migrations/1.3.0.js
export default {
  version: '1.3.0',
  type: 'schema',
  description: 'Add subscription events table',
  
  up: './migrations/1.3.0/up.sql',
  down: './migrations/1.3.0/down.sql',
}
```

With SQL file:
```sql
-- migrations/1.3.0/up.sql
CREATE TABLE IF NOT EXISTS stripe_subscription_events (
  id SERIAL PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_sub_events_sub_id 
  ON stripe_subscription_events(subscription_id);
```
