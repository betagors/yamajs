# Yama Migration System Documentation

## Overview

Yama provides a comprehensive, multi-layered migration system designed to handle:

1. **Entity/Schema Migrations** - Database schema changes based on entity definitions
2. **Plugin Migrations** - Plugin-specific database setup and updates
3. **Safety & Analysis** - Destructive operation detection and risk assessment
4. **Locking & Transactions** - Concurrent execution prevention and atomic updates

This document provides a detailed explanation of each component.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Graph-Based Migrations](#-graph-based-migrations-unique-feature)
3. [Entity/Schema Migration System](#entityschema-migration-system)
4. [Plugin Migration System](#plugin-migration-system)
5. [Safety & Analysis System](#safety--analysis-system)
6. [Shadow Columns (Zero-Downtime Drops)](#-shadow-columns-zero-downtime-drops)
7. [Audit Logging](#-audit-logging)
8. [Schema Merge System](#-schema-merge-system-git-like-merge)
9. [Safety Operations](#safety-operations)
10. [Database Capability Detection](#database-capability-detection)
11. [Migration Validation](#migration-validation)
12. [Migration Locking](#migration-locking)
13. [Migration Runner](#migration-runner)
14. [Versioning & Snapshots](#versioning--snapshots)
15. [Backup System](#backup-system)
16. [CLI Commands](#cli-commands)
17. [Database Tables](#database-tables)
18. [File Structure](#file-structure)
19. [Complete Feature Summary](#complete-feature-summary)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YAMA MIGRATION SYSTEM                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │ ENTITY MIGRATIONS │     │ PLUGIN MIGRATIONS │                 │
│  │                  │     │                   │                  │
│  │  • Schema Diff   │     │  • Version-based  │                  │
│  │  • SQL Generation│     │  • Semver Support │                  │
│  │  • Transitions   │     │  • Manifest-driven│                  │
│  └────────┬─────────┘     └─────────┬─────────┘                  │
│           │                         │                            │
│           └───────────┬─────────────┘                            │
│                       ▼                                          │
│          ┌────────────────────────┐                              │
│          │   SAFETY ANALYSIS      │                              │
│          │                        │                              │
│          │  • Destructive Ops     │                              │
│          │  • Risk Levels         │                              │
│          │  • Warnings            │                              │
│          └───────────┬────────────┘                              │
│                      ▼                                           │
│          ┌────────────────────────┐                              │
│          │   MIGRATION RUNNER     │                              │
│          │                        │                              │
│          │  • Transactions        │                              │
│          │  • Locking             │                              │
│          │  • Rollback            │                              │
│          │  • Lifecycle Hooks     │                              │
│          └───────────┬────────────┘                              │
│                      ▼                                           │
│          ┌────────────────────────┐                              │
│          │     DATABASE           │                              │
│          │  (PostgreSQL/PGLite)   │                              │
│          └────────────────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⭐ Graph-Based Migrations (Unique Feature)

**Unlike traditional linear migration tools**, Yama uses a **Directed Acyclic Graph (DAG)** for entity/schema migrations. This is one of Yama's unique architectural decisions.

### Traditional Linear vs Yama Graph

**Linear (Rails, Prisma, Drizzle, etc.):**
```
001_initial → 002_users → 003_posts → 004_comments
      ↓           ↓           ↓           ↓
    (must run in exact sequential order)
```

**Yama Graph-Based:**
```
                    ┌─────────────┐
                    │  Snapshot A  │
                    │  (hash: abc) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌───────────┐ ┌───────────┐ ┌───────────┐
        │ Snapshot B │ │ Snapshot C │ │ Snapshot D │
        └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
              │             │             │
              └──────┬──────┘             │
                     ▼                    ▼
               ┌───────────┐        ┌───────────┐
               │ Snapshot E │        │ Snapshot F │
               └───────────┘        └───────────┘
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Snapshot** | A complete schema state with a SHA-256 hash (node in graph) |
| **Transition** | Migration steps between two snapshots (edge in graph) |
| **Path** | Sequence of transitions to go from one snapshot to another |
| **Graph** | DAG containing all snapshots and transitions |

### Graph Structure (`graph.ts`)

```typescript
interface TransitionGraph {
  nodes: Set<string>;                    // Snapshot hashes
  edges: Map<string, Set<string>>;       // fromHash → Set<toHash>
  transitions: Map<string, Transition>;  // transitionHash → Transition
}
```

### Path Finding Algorithms

Yama uses **Breadth-First Search (BFS)** to find migration paths:

```typescript
// Find SHORTEST path from current to target state
findPath(configDir, fromHash, toHash): PathResult | null

// Find reverse path (for rollback)
findReversePath(configDir, fromHash, toHash): PathResult | null

// Find ALL possible paths between states
findAllPaths(configDir, fromHash, toHash): PathResult[]

// Check if migration path exists
pathExists(configDir, fromHash, toHash): boolean
```

### Reachability Analysis

```typescript
// Get all snapshots reachable from current state
getReachableSnapshots(configDir, fromHash): string[]

// Get all snapshots that can reach a target state
getPredecessorSnapshots(configDir, toHash): string[]
```

### Advantages Over Linear Migrations

| Feature | Linear | Graph (Yama) |
|---------|--------|--------------|
| **Branching** | ❌ Single path | ✅ Multiple parallel paths |
| **Rollback** | Previous version only | Any reachable state |
| **Team Collaboration** | Migration conflicts | Parallel development |
| **Merge** | Manual resolution | Automatic path finding |
| **Shortest Path** | N/A | ✅ BFS-optimized |
| **State Identity** | File-based | Hash-based |

### Example: Parallel Team Development

**Developer A** (branch A) adds users:
```
Snapshot 1 → [add users] → Snapshot 2a
```

**Developer B** (branch B) adds products:
```
Snapshot 1 → [add products] → Snapshot 2b
```

**Merging:**
- Yama detects both snapshots share parent `Snapshot 1`
- Can find path: `2a → merged` or `2b → merged`
- No manual conflict resolution needed if schemas don't overlap

### Storage

Graph stored in: `.yama/graph.json`

```json
{
  "nodes": ["abc123", "def456", "ghi789"],
  "edges": {
    "abc123": ["def456", "ghi789"],
    "def456": ["xyz000"]
  },
  "transitionHashes": ["trans1", "trans2", "trans3"]
}
```

### Hybrid Approach

Yama uses **both** systems:

| Migration Type | Approach | Reason |
|----------------|----------|--------|
| **Entity/Schema** | Graph (DAG) | Flexible, parallel development |
| **Plugin** | Linear (Semver) | Simpler for package authors |

---

## Entity/Schema Migration System

The entity migration system handles database schema changes based on Yama entity definitions. It uses a diff-based approach comparing the current schema state with the desired state.

### Core Components

#### 1. Model (`model.ts`)

Represents the database schema as an internal model for comparison.

```typescript
interface Model {
  hash: string;                    // SHA-256 hash of normalized entities
  entities: YamaEntities;          // Original entity definitions
  tables: Map<string, TableModel>; // Parsed table representations
}

interface TableModel {
  name: string;
  columns: Map<string, ColumnModel>;
  indexes: IndexModel[];
  foreignKeys: ForeignKeyModel[];
}

interface ColumnModel {
  name: string;
  type: string;      // SQL type (e.g., "VARCHAR(255)")
  nullable: boolean;
  primary: boolean;
  default?: unknown;
  generated?: boolean;
}
```

**Key Functions:**
- `entitiesToModel(entities)` - Converts YamaEntities to internal Model
- `computeModelHash(entities)` - Computes SHA-256 hash for change detection
- `compareModels(from, to)` - Compares two models for changes

#### 2. Diff Engine (`diff.ts`)

Computes differences between two schema models.

```typescript
interface DiffResult {
  added: {
    tables: string[];
    columns: Array<{ table: string; column: string }>;
    indexes: Array<{ table: string; index: string }>;
    foreignKeys: Array<{ table: string; fk: string }>;
  };
  removed: {
    tables: string[];
    columns: Array<{ table: string; column: string }>;
    indexes: Array<{ table: string; index: string }>;
    foreignKeys: Array<{ table: string; fk: string }>;
  };
  modified: {
    tables: Array<{ table: string; changes: string[] }>;
    columns: Array<{ table: string; column: string; changes: string[] }>;
  };
}
```

**Migration Step Types:**

| Step Type | Description |
|-----------|-------------|
| `add_table` | Create a new table with columns |
| `drop_table` | Remove an existing table |
| `add_column` | Add a column to a table |
| `drop_column` | Remove a column from a table |
| `rename_column` | Rename a column |
| `modify_column` | Change column type/nullable/default |
| `add_index` | Create an index |
| `drop_index` | Remove an index |
| `add_foreign_key` | Add a foreign key constraint |
| `drop_foreign_key` | Remove a foreign key constraint |

**Key Functions:**
- `computeDiff(from, to)` - Computes DiffResult between two Models
- `diffToSteps(diff, from, to)` - Converts diff to migration steps

#### 3. Generator (`generator.ts`)

Generates complete migrations from entity changes.

```typescript
interface GeneratedMigration {
  name: string;              // e.g., "20231210143025_add_users"
  generatedAt: string;       // ISO timestamp
  fromHash: string | null;   // Source schema hash
  toHash: string;            // Target schema hash
  up: MigrationStepUnion[];  // Forward migration steps
  down: MigrationStepUnion[];// Rollback steps
  diff: DiffResult;          // Reference diff
  safety: MigrationSafetyInfo;
  hasDestructiveOperations: boolean;
  summary: MigrationSummary;
}

interface MigrationSafetyInfo {
  level: SafetyLevel;        // Safe, RequiresReview, Unsafe, Dangerous
  warnings: string[];
  recommendations: string[];
  requiresBackup: boolean;
  requiresDowntime: boolean;
}
```

**Key Functions:**
- `generateMigration(projectDir, entities, options)` - Generate migration from current entities
- `formatMigration(migration)` - Human-readable output
- `hasEntityChanges(projectDir, entities)` - Check if entities changed

**Options:**
```typescript
interface MigrationGeneratorOptions {
  preview?: boolean;        // Don't create files
  interactive?: boolean;    // Prompt for confirmation
  destructive?: boolean;    // Allow DROP operations
  includeRollback?: boolean;// Generate down migrations
  name?: string;            // Custom migration name
}
```

#### 4. Transitions (`transitions.ts`)

Represents migration paths between schema snapshots.

```typescript
interface Transition {
  hash: string;             // Unique transition hash
  fromHash: string;         // Source snapshot hash
  toHash: string;           // Target snapshot hash
  steps: MigrationStepUnion[];
  metadata: TransitionMetadata;
}
```

**Storage Location:** `.yama/transitions/<hash>.json`

---

## Plugin Migration System

Plugins can define their own migrations that run when the plugin is installed or updated.

### Plugin Manifest

Migrations are defined in the plugin's manifest:

```typescript
interface PluginManifest {
  migrations?: Record<string, PluginMigrationDefinition>;
  initialSchema?: string | (() => Promise<string> | string);
  // ...other fields
}

interface PluginMigrationDefinition {
  up: string | (() => Promise<void> | void);   // SQL file path or function
  down?: string | (() => Promise<void> | void); // Rollback (optional)
  type?: 'schema' | 'config' | 'data';          // Migration type
  description?: string;
}
```

**Example Plugin Manifest:**
```javascript
// plugin.js
export default {
  name: '@yamajs/plugin-stripe',
  version: '1.3.0',
  
  manifest: {
    migrations: {
      '1.0.0': {
        up: './migrations/1.0.0/up.sql',
        down: './migrations/1.0.0/down.sql',
        type: 'schema',
        description: 'Initial Stripe tables'
      },
      '1.2.0': {
        up: './migrations/1.2.0/up.sql',
        type: 'schema',
        description: 'Add webhooks table'
      },
      '1.3.0': {
        up: './migrations/1.3.0/up.sql',
        type: 'schema',
        description: 'Add subscription events'
      }
    }
  },
  
  async init(opts, context) { /* ... */ }
};
```

### Migration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   PLUGIN MIGRATION FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Plugin Loading                                           │
│     ├─ Load plugin manifest                                  │
│     └─ Get migrations from manifest                          │
│                                                              │
│  2. Version Check                                            │
│     ├─ Query _yama_plugin_versions for installed version     │
│     └─ Compare with current plugin version                   │
│                                                              │
│  3. Pending Migrations                                       │
│     ├─ Filter migrations: installedVersion < v <= currentVer │
│     └─ Sort by semver                                        │
│                                                              │
│  4. Execute (via MigrationRunner)                            │
│     ├─ Acquire lock                                          │
│     ├─ Safety analysis                                       │
│     ├─ BEGIN TRANSACTION                                     │
│     ├─ For each migration:                                   │
│     │   ├─ onBeforeMigrate hook                              │
│     │   ├─ Execute SQL/function                              │
│     │   ├─ Record in _yama_plugin_migrations                 │
│     │   └─ onAfterMigrate hook                               │
│     ├─ Update _yama_plugin_versions                          │
│     ├─ COMMIT                                                │
│     └─ Release lock                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Plugin Migration Functions (`migrations.ts`)

**Key Functions:**

```typescript
// Ensure tracking tables exist
ensurePluginMigrationTables(sql: any): Promise<void>

// Get installed plugin version
getInstalledPluginVersion(pluginName: string, sql: any): Promise<string | null>

// Get pending migrations between versions
getPendingPluginMigrations(
  plugin: YamaPlugin,
  manifest: PluginManifest,
  installedVersion: string | null,
  currentVersion: string
): Promise<PluginMigration[]>

// Execute a single migration
executePluginMigration(
  migration: PluginMigration,
  sql: any,
  pluginDir: string
): Promise<void>

// Rollback migrations
rollbackPluginMigration(
  pluginName: string,
  toVersion: string,
  sql: any,
  pluginDir: string,
  manifest: PluginManifest
): Promise<void>

// Update version record
updatePluginVersion(
  pluginName: string,
  version: string,
  sql: any
): Promise<void>

// Get migration history
getPluginMigrationHistory(
  pluginName: string,
  sql: any
): Promise<Array<{version, migration_name, applied_at, type}>>
```

---

## Safety & Analysis System

Yama analyzes migrations for potentially destructive operations before execution.

### Safety Levels

```typescript
enum SafetyLevel {
  Safe = 0,           // Can be auto-deployed
  RequiresReview = 1, // Needs human review
  Unsafe = 2,         // May cause issues
  Dangerous = 3       // Will cause data loss
}
```

### Migration Safety Analysis (`migration-safety.ts`)

Analyzes SQL for destructive patterns:

| Operation | Type | Severity | Reversible |
|-----------|------|----------|------------|
| `DROP TABLE` | DROP_TABLE | danger | ❌ |
| `ALTER TABLE ... DROP COLUMN` | DROP_COLUMN | danger | ❌ |
| `DROP DATABASE` | DROP_DATABASE | danger | ❌ |
| `DROP SCHEMA` | DROP_SCHEMA | danger | ❌ |
| `TRUNCATE` | TRUNCATE | danger | ❌ |
| `DELETE FROM` (no WHERE) | DELETE_ALL | danger | ❌ |
| `ALTER COLUMN TYPE` | ALTER_TYPE | warning | ❌ |
| `DROP INDEX` | DROP_INDEX | warning | ✅ |
| `DROP CONSTRAINT` | DROP_CONSTRAINT | warning | ✅ |
| `RENAME COLUMN` | RENAME_COLUMN | warning | ✅ |

**Risk Level Calculation:**
- `low` - No destructive operations
- `medium` - Warnings only
- `high` - 1+ danger operations
- `critical` - 3+ danger OR 2+ irreversible operations

```typescript
interface MigrationSafetyAnalysis {
  safe: boolean;
  requiresConfirmation: boolean;
  requiresBackup: boolean;
  destructiveOperations: DestructiveOperation[];
  warnings: string[];
  affectedTables: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

// Usage
const analysis = analyzeMigrationSafety(sqlContent, migrationName);
console.log(formatSafetyAnalysis(analysis));
```

### Schema Safety (`safety.ts`)

Classifies migration steps by safety level:

```typescript
// Classify individual step
const assessment = classifyStep(step);
// { level, reasons, canAutoDeploy, requiresApproval }

// Assess entire transition
const assessment = assessTransition(transition);

// Environment-aware assessment
const assessment = assessSafety(steps, 'production');
// Adds: blockedInProduction, warnings, recommendations

// Validate for environment
const { valid, errors, warnings } = validateForEnvironment(
  steps, 
  'production', 
  { allowDestructive: false }
);
```

---

## ⭐ Shadow Columns (Zero-Downtime Drops)

Instead of permanently deleting columns, Yama can **rename them to shadow columns** with a configurable retention period. This enables zero-downtime migrations with data recovery options.

### How It Works

```
Traditional DROP:  DROP COLUMN email  →  Data lost forever ❌

Yama Shadow:       RENAME COLUMN email TO _shadow_email_abc123_2024-01-01  →  Data preserved ✅
                   (Automatically cleaned up after retention period)
```

### Shadow Column Structure (`shadows.ts`)

```typescript
interface ShadowColumn {
  column: string;          // Shadow column name (e.g., _shadow_email_abc123_...)
  originalName: string;    // Original column name
  table: string;           // Table name
  snapshot: string;        // Associated snapshot hash
  createdAt: string;       // ISO timestamp
  expiresAt: string;       // Retention expiration (default: 30 days)
  rowCount?: number;       // Number of rows affected
  size?: string;           // Size of data
  status: "active" | "restored" | "expired";
}
```

### Shadow Column Naming

```typescript
// Pattern: _shadow_{originalName}_{snapshotHash8}_{timestamp}
generateShadowColumnName("email", "abc12345")
// → "_shadow_email_abc12345_2024-01-01T12-30-00"
```

### Key Functions

```typescript
// Register a shadow column
registerShadowColumn(configDir, shadow: ShadowColumn)

// Get shadow column by name
getShadowColumn(configDir, table, column): ShadowColumn | null

// Get all shadow columns for a table
getShadowColumnsForTable(configDir, table): ShadowColumn[]

// Get all active (non-expired) shadow columns
getActiveShadowColumns(configDir): ShadowColumn[]

// Get expired shadow columns (ready for cleanup)
getExpiredShadowColumns(configDir): ShadowColumn[]

// Mark shadow as restored (data recovered)
markShadowRestored(configDir, table, column)

// Check if shadow is expired
isShadowExpired(shadow): boolean
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Data Preservation** | Data is kept for 30 days (configurable) |
| **Easy Recovery** | Simple rename to restore data |
| **Zero Downtime** | No table locks or data loss |
| **Automatic Cleanup** | Expired shadows can be purged |
| **Audit Trail** | Track when/why columns were "deleted" |

### Storage

Shadow manifest: `.yama/shadows/manifest.json`

---

## ⭐ Audit Logging

Yama provides built-in audit logging to track all database changes during migrations.

### Audit Log Entry (`audit.ts`)

```typescript
interface AuditLogEntry {
  id: string;                                    // UUID
  timestamp: string;                             // ISO timestamp
  snapshot: string;                              // Associated snapshot hash
  table_name: string;                            // Affected table
  record_id: string;                             // Affected record ID
  operation: "INSERT" | "UPDATE" | "DELETE";     // Operation type
  old_data: Record<string, unknown> | null;      // Data before change
  new_data: Record<string, unknown> | null;      // Data after change
  changed_by?: string;                           // User ID who made change
  changed_via?: string;                          // Source ("yama-deploy", "api", etc.)
  metadata?: Record<string, unknown>;            // Additional context
}
```

### Audit Configuration

```typescript
interface AuditConfig {
  enabled: boolean;
  track?: Array<{
    entity: string;                              // Entity to track
    operations: Array<"create" | "update" | "delete" | "all">;
  }>;
  retention?: string;                            // e.g., "90d"
  storage?: "database" | "s3" | "file";
}
```

### Audit Database Table

```sql
CREATE TABLE IF NOT EXISTS _yama_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  snapshot VARCHAR(255),
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  operation VARCHAR(10) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_via VARCHAR(255),
  metadata JSONB
);

-- Indexes for fast querying
CREATE INDEX idx_audit_log_table_record ON _yama_audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_timestamp ON _yama_audit_log(timestamp);
CREATE INDEX idx_audit_log_operation ON _yama_audit_log(operation);
CREATE INDEX idx_audit_log_snapshot ON _yama_audit_log(snapshot);
```

### Key Functions

```typescript
// Check if operation should be audited
shouldAudit(config, entity, operation): boolean

// Create an audit log entry
createAuditEntry(
  tableName, recordId, operation, oldData, newData, snapshot, options
): AuditLogEntry

// Parse retention period ("90d" → 90)
parseRetentionPeriod(retention: string): number

// Check if audit entry is expired
isAuditEntryExpired(entry, retentionDays): boolean
```

---

## ⭐ Schema Merge System (Git-like Merge)

Yama provides a **three-way merge** system for schemas, similar to Git. This enables parallel development across branches.

### Merge Concepts

```
               Base Schema
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   Local Changes         Remote Changes
   (your branch)         (other branch)
         │                     │
         └──────────┬──────────┘
                    ▼
            Merged Schema
         (or conflicts detected)
```

### Merge Result (`merge.ts`)

```typescript
interface MergeResult {
  success: boolean;            // True if merge succeeded
  merged: YamaEntities | null; // Merged schema (if no conflicts)
  conflicts: Conflict[];       // List of conflicts
  canAutoMerge: boolean;       // True if no conflicts
  mergedSnapshot?: Snapshot;   // Resulting snapshot
}
```

### Conflict Types

```typescript
type ConflictType =
  | "field_removed_but_used"     // Field removed in one branch, modified in other
  | "field_type_mismatch"        // Same field has different types
  | "field_required_mismatch"    // Different nullable/required settings
  | "entity_removed_but_used"    // Entity removed in one branch, modified in other
  | "ambiguous_change";          // Both branches changed same thing differently

interface Conflict {
  type: ConflictType;
  entity: string;
  field?: string;
  description: string;
  localChange: string;
  remoteChange: string;
}
```

### Usage

```typescript
// Merge two divergent schemas
const result = mergeSchemas(baseSchema, localSchema, remoteSchema);

if (result.canAutoMerge) {
  // No conflicts - use merged schema
  console.log("Auto-merge successful!");
  saveSnapshot(configDir, createSnapshot(result.merged!, metadata));
} else {
  // Handle conflicts
  console.log("Conflicts detected:");
  for (const conflict of result.conflicts) {
    console.log(`  ${conflict.type}: ${conflict.entity}.${conflict.field}`);
    console.log(`    Local: ${conflict.localChange}`);
    console.log(`    Remote: ${conflict.remoteChange}`);
  }
}

// Check if auto-merge is possible
if (canAutoMerge(base, local, remote)) {
  // Safe to merge
}

// Get list of conflicts without merging
const conflicts = detectConflicts(base, local, remote);
```

### Example Scenarios

**Scenario 1: No Conflicts (Auto-merge)**
```
Base:   User { id, name }
Local:  User { id, name, email }     ← Added email
Remote: User { id, name, phone }     ← Added phone

Merged: User { id, name, email, phone }  ✅ Auto-merged
```

**Scenario 2: Conflict**
```
Base:   User { id, name }
Local:  User { id, name, email: string }    ← Added email as string
Remote: User { id, name, email: integer }   ← Added email as integer

Conflict: field_type_mismatch on User.email ❌
```

---

## Safety Operations

Automatic safety measures during destructive migrations (`safety-ops.ts`).

### Safety Options

```typescript
interface SafetyOptions {
  enableShadows?: boolean;       // Use shadow columns for drops (default: true)
  enableSnapshots?: boolean;     // Create data snapshots (default: true)
  enableAudit?: boolean;         // Enable audit logging (default: false)
  shadowRetentionDays?: number;  // Shadow column retention (default: 30)
  backupRetention?: string;      // Backup retention (default: "30d")
  auditConfig?: AuditConfig;     // Audit configuration
}
```

### Safety Pre-Check

```typescript
interface SafetyPreCheckResult {
  shadowSteps: MigrationStepUnion[];     // Steps needing shadow columns
  snapshotSteps: MigrationStepUnion[];   // Steps needing data snapshots
  auditSteps: MigrationStepUnion[];      // Steps to audit
  destructiveCount: number;               // Total destructive steps
  needsSafety: boolean;                   // Whether any safety measures needed
}

// Check what safety measures are needed
const safety = checkSafetyNeeds(steps, capabilities, options);
if (safety.needsSafety) {
  console.log(`${safety.destructiveCount} destructive operations detected`);
  console.log(`${safety.shadowSteps.length} will use shadow columns`);
}
```

### Safety-Aware SQL Generation

```typescript
// Instead of generating: DROP COLUMN email
// Generates: ALTER TABLE users RENAME COLUMN email TO _shadow_email_...

const result = generateSafetyAwareSQL(
  steps,
  generateStepSQL,
  snapshotHash,
  capabilities,
  options
);

console.log(result.sql);           // The safe SQL
console.log(result.shadowColumns); // Created shadow columns
console.log(result.snapshots);     // Created data snapshots
```

---

## Database Capability Detection

Yama detects and adapts to different database capabilities (`plugin-interface.ts`).

### Database Capabilities

```typescript
interface DatabaseCapabilities {
  addTable: boolean;
  dropTable: boolean;
  addColumn: boolean;
  dropColumn: boolean;
  modifyColumnType: boolean;      // Can change column type
  modifyColumnNullable: boolean;  // Can change nullability
  modifyColumnDefault: boolean;   // Can change default value
  renameColumn: boolean;
  addIndex: boolean;
  dropIndex: boolean;
  foreignKeys: boolean;
  transactionalDDL: boolean;      // DDL in transactions
  shadowColumns: boolean;         // Support for shadow columns
  concurrentIndexes: boolean;     // CREATE INDEX CONCURRENTLY
  onlineDDL: boolean;             // Minimal locking DDL
}
```

### Pre-defined Capabilities

```typescript
// PostgreSQL - Full support
POSTGRES_CAPABILITIES = {
  addTable: true,
  dropTable: true,
  addColumn: true,
  dropColumn: true,
  modifyColumnType: true,
  modifyColumnNullable: true,
  modifyColumnDefault: true,
  renameColumn: true,
  addIndex: true,
  dropIndex: true,
  foreignKeys: true,
  transactionalDDL: true,      // ✅ DDL is transactional
  shadowColumns: true,
  concurrentIndexes: true,     // ✅ CONCURRENTLY keyword
  onlineDDL: true,
}

// MySQL - No transactional DDL
MYSQL_CAPABILITIES = {
  ...
  transactionalDDL: false,     // ❌ DDL auto-commits
  concurrentIndexes: false,
  onlineDDL: true,             // ALGORITHM=INPLACE
}

// SQLite - Limited ALTER support
SQLITE_CAPABILITIES = {
  dropColumn: false,           // ❌ Not supported natively
  modifyColumnType: false,
  modifyColumnNullable: false,
  modifyColumnDefault: false,
  ...
}
```

### Validation Against Capabilities

```typescript
// Check if step is supported
if (!isStepSupported(step, capabilities)) {
  console.warn(`${step.type} not supported by this database`);
}

// Validate all steps
const { supported, unsupported } = validateStepsAgainstCapabilities(
  steps,
  capabilities
);

if (unsupported.length > 0) {
  console.error(`${unsupported.length} steps not supported`);
}
```

---

## Migration Validation

Pre-flight checks before executing migrations (`validator.ts`).

### Validation Errors

```typescript
interface ValidationError {
  step?: number;    // Step index (if applicable)
  message: string;  // Error description
  field?: string;   // Affected field (if applicable)
}
```

### Hash Validation

```typescript
// Verify transition matches current database state
const errors = validateMigrationHash(transition, currentModel);
// [
//   { message: "Transition fromHash (abc12345) does not match current model hash (def67890)" }
// ]
```

### Dependency Validation

```typescript
// Verify tables/columns exist before modifying them
const errors = validateStepDependencies(steps, currentModel);
// [
//   { step: 2, message: "Table 'users' does not exist" },
//   { step: 5, message: "Referenced table 'roles' does not exist and was not added in previous steps" }
// ]
```

### Full Transition Validation

```typescript
// Run all validations
const errors = validateTransition(transition, currentModel);

if (errors.length > 0) {
  console.error("Migration cannot proceed:");
  for (const error of errors) {
    const stepInfo = error.step !== undefined ? `[Step ${error.step}] ` : "";
    console.error(`  ${stepInfo}${error.message}`);
  }
  process.exit(1);
}
```

### What Gets Validated

| Check | Description |
|-------|-------------|
| **Hash Match** | Transition's `fromHash` matches current DB state |
| **Table Exists** | Tables exist before modifying columns/indexes |
| **Table Added First** | If adding column to new table, table is added first |
| **FK References** | Foreign key target tables exist |
| **Step Order** | Dependencies satisfied by previous steps |

---

## Migration Locking

Prevents concurrent migrations using PostgreSQL advisory locks.

### MigrationLock (`migration-lock.ts`)

```typescript
interface MigrationLockOptions {
  timeoutMs?: number;       // Default: 30000 (30s)
  retryIntervalMs?: number; // Default: 1000 (1s)
  sessionLevel?: boolean;   // Default: true
}

class MigrationLock {
  constructor(db: any, pluginName: string, options?: MigrationLockOptions);
  
  acquire(): Promise<boolean>;   // Acquire lock (with retry)
  release(): Promise<void>;       // Release lock
  isLocked(): Promise<boolean>;   // Check if currently locked
  getStatus(): LockStatus;        // Get lock status
}
```

**Usage:**
```typescript
// Helper function (recommended)
await withMigrationLock(db, '@yamajs/plugin-stripe', async () => {
  await runMigrations();
});

// Manual usage
const lock = new MigrationLock(db, 'my-plugin');
await lock.acquire();
try {
  await runMigrations();
} finally {
  await lock.release();
}

// Global lock for all plugins
const globalLock = createGlobalMigrationLock(db);
```

**Implementation Details:**
- Uses `pg_try_advisory_lock()` for PostgreSQL
- Falls back to in-memory Map for non-PostgreSQL databases
- Lock ID is computed from plugin name hash
- Session-level locks release on disconnect
- Transaction-level locks release on commit/rollback

---

## Migration Runner

Orchestrates the entire migration execution with transactions, locking, and lifecycle hooks.

### MigrationRunner (`migration-runner.ts`)

```typescript
interface MigrationRunnerOptions {
  transactional?: boolean;      // Wrap in transaction (default: true)
  dryRun?: boolean;             // Preview without executing
  skipSafetyAnalysis?: boolean; // Skip safety checks
  force?: boolean;              // Force even if destructive
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

interface MigrationExecutionResult {
  success: boolean;
  migrationsRun: number;
  failedMigration?: { version: string; error: Error };
  safetyAnalysis: MigrationSafetyAnalysis;
  duration: number;
  rolledBack: boolean;
}
```

**Usage:**
```typescript
const runner = new MigrationRunner(db, {
  transactional: true,
  dryRun: false,
  force: false,
});

const result = await runner.run(plugin, manifest, migrations, pluginDir);

if (result.success) {
  console.log(`Ran ${result.migrationsRun} migrations in ${result.duration}ms`);
} else {
  console.error(`Failed at version ${result.failedMigration.version}`);
  if (result.rolledBack) {
    console.log('Transaction was rolled back');
  }
}

// Convenience functions
const result = await runPluginMigrations(db, plugin, manifest, migrations, pluginDir, options);
const preview = await dryRunMigrations(db, plugin, manifest, migrations, pluginDir);
```

**Execution Flow:**
1. Load and analyze migration SQL
2. Perform safety analysis
3. Check if confirmation required
4. Acquire migration lock
5. Begin transaction (PostgreSQL)
6. For each migration:
   - Call `plugin.onBeforeMigrate(fromVersion, toVersion)`
   - Execute SQL or migration function
   - Record in `_yama_plugin_migrations`
   - Call `plugin.onAfterMigrate(fromVersion, toVersion)`
7. Update `_yama_plugin_versions`
8. Commit transaction (or rollback on error)
9. Release lock

**Plugin Lifecycle Hooks:**
```typescript
interface PluginLifecycle {
  onBeforeMigrate?(fromVersion: string, toVersion: string): Promise<void> | void;
  onAfterMigrate?(fromVersion: string, toVersion: string): Promise<void> | void;
  onMigrationError?(error: Error, fromVersion: string, toVersion: string): Promise<void> | void;
}
```

---

## Versioning & Snapshots

### Schema Versioning (`versioning.ts`)

Tracks schema versions with checksums for migration management.

```typescript
interface SchemaVersion {
  version: string;           // Semver or auto-generated
  hash: string;              // SHA-256 of schema
  changedEntities: string[]; // Entities that changed
  appliedAt: string;         // ISO timestamp
  description?: string;
  previousVersion?: string;
  previousHash?: string;
}

interface SchemaVersionHistory {
  currentVersion: string;
  currentHash: string;
  versions: SchemaVersion[];
  updatedAt: string;
}
```

**Storage Location:** `.yama/versions/history.json`

**Key Functions:**
```typescript
computeSchemaHash(entities)           // Compute hash
getCurrentSchemaVersion(projectDir)   // Get current version
recordSchemaVersion(projectDir, entities, options)
hasSchemaChanged(projectDir, entities)
listSchemaVersions(projectDir)
getVersionDiff(projectDir, fromVersion, toVersion)
loadEntitySnapshot(projectDir, version)
```

### Snapshots (`snapshots.ts`)

Point-in-time captures of the schema.

```typescript
interface Snapshot {
  hash: string;
  parentHash?: string;
  entities: YamaEntities;
  metadata: SnapshotMetadata;
}

interface SnapshotMetadata {
  createdAt: string;
  createdBy: string;
  description?: string;
}
```

**Storage Location:** `.yama/snapshots/<hash>.json`

**Key Functions:**
```typescript
createSnapshot(entities, metadata, parentHash?)
saveSnapshot(configDir, snapshot)
loadSnapshot(configDir, hash)
getAllSnapshots(configDir)
findSnapshot(configDir, partialHash)
deleteSnapshot(configDir, hash)
```

---

## Backup System

### Backups (`backups.ts`)

Manages database backups tied to migrations.

```typescript
interface BackupMetadata {
  snapshot: string;
  timestamp: string;
  database: { provider: string; version?: string; size?: string };
  tables: Record<string, { rows: number; size: string }>;
  trigger: 'schema_transition' | 'data_transformation' | 'schedule' | 'production_deploy' | 'manual';
  transition?: string;
  checksum: string;
  compression?: { algorithm: string; level: number };
  retentionPolicy: string;  // e.g., "30d"
}

interface BackupChain {
  base: string;
  fullBackup: string;
  size: string;
  incrementals: Array<{
    snapshot: string;
    file: string;
    size: string;
    changes: string[];
  }>;
  totalSize: string;
}
```

**Storage Locations:**
- `.yama/backups/snapshots/` - Backup files
- `.yama/backups/incremental/` - Incremental backups
- `.yama/backups/manifests/` - Backup metadata

**Key Functions:**
```typescript
registerBackup(configDir, metadata, filename)
listBackups(configDir)
getBackupsForSnapshot(configDir, snapshot)
createBackupChain(configDir, baseSnapshot)
isBackupExpired(metadata, now?)
getExpiredBackups(configDir)
calculateBackupSize(configDir)
```

---

## CLI Commands

### Plugin Migration Commands

```bash
# Run all pending plugin migrations
yama plugin migrate

# Migrate specific plugin
yama plugin migrate --plugin @yamajs/plugin-stripe

# Dry run (preview only)
yama plugin migrate --dry-run

# Force (skip confirmations)
yama plugin migrate --force

# Interactive mode
yama plugin migrate --interactive

# Rollback plugin to version
yama plugin rollback @yamajs/plugin-stripe --to 1.2.0
```

### Schema Commands

```bash
# Check schema status
yama schema status

# Generate migration from entities
yama schema generate

# Apply pending migrations
yama schema apply

# Rollback to previous version
yama schema rollback

# View migration history
yama schema history

# Create manual snapshot
yama snapshot create

# List snapshots
yama snapshot list

# Manage backups
yama backups list
yama backups create
yama backups restore <id>
```

---

## Database Tables

Yama creates these internal tables for migration tracking:

### `_yama_plugin_migrations`

Tracks applied plugin migrations.

```sql
CREATE TABLE IF NOT EXISTS _yama_plugin_migrations (
  id SERIAL PRIMARY KEY,
  plugin_name VARCHAR(255) NOT NULL,
  plugin_version VARCHAR(50) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  migration_type VARCHAR(50) DEFAULT 'schema',
  checksum VARCHAR(64),
  applied_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plugin_name, migration_name)
);
```

### `_yama_plugin_versions`

Tracks installed plugin versions.

```sql
CREATE TABLE IF NOT EXISTS _yama_plugin_versions (
  plugin_name VARCHAR(255) PRIMARY KEY,
  installed_version VARCHAR(50) NOT NULL,
  previous_version VARCHAR(50),
  installed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## File Structure

```
.yama/
├── versions/
│   ├── history.json         # Schema version history
│   └── snapshots/
│       ├── 0.0.1.json       # Entity snapshot for version 0.0.1
│       └── 0.0.2.json
│
├── snapshots/
│   ├── manifest.json        # Snapshot manifest
│   ├── <hash1>.json         # Individual snapshots
│   └── <hash2>.json
│
├── transitions/
│   └── <hash>.json          # Migration transitions
│
├── backups/
│   ├── snapshots/           # Backup files
│   ├── incremental/         # Incremental backups
│   └── manifests/           # Backup metadata
│
└── state/
    ├── development.json     # Environment state
    ├── staging.json
    └── production.json

migrations/                   # User migrations directory
├── 0001_initial.sql
├── 0002_add_users.sql
└── 0003_add_orders.sql
```

---

## Migration Types Summary

| Type | Scope | Trigger | Location |
|------|-------|---------|----------|
| Entity Migration | Schema (tables/columns) | `yama schema generate` | `.yama/transitions/` |
| Plugin Migration | Plugin-specific tables | Plugin install/update | Plugin package |
| Manual Migration | Any SQL | User-created | `migrations/` directory |

---

## Complete Feature Summary

| Feature | Module | Description |
|---------|--------|-------------|
| **Graph-Based Migrations** | `graph.ts` | DAG with BFS path finding |
| **Schema Diff** | `diff.ts` | Compare two models |
| **Migration Generator** | `generator.ts` | Generate steps + rollback |
| **Safety Analysis** | `safety.ts`, `migration-safety.ts` | Risk assessment |
| **Shadow Columns** | `shadows.ts` | Zero-downtime column drops |
| **Audit Logging** | `audit.ts` | Full change history |
| **Schema Merge** | `merge.ts` | Three-way merge with conflict detection |
| **Safety Operations** | `safety-ops.ts` | Automatic safety measures |
| **Database Capabilities** | `plugin-interface.ts` | Database feature detection |
| **Validation** | `validator.ts` | Pre-flight checks |
| **Transitions** | `transitions.ts` | Migration paths |
| **Snapshots** | `snapshots.ts` | Point-in-time captures |
| **Versioning** | `versioning.ts` | Schema version tracking |
| **Backups** | `backups.ts` | Backup management |
| **State** | `state.ts` | Environment state |
| **Plugin Migrations** | `migrations.ts` | Plugin version-based migrations |
| **Migration Lock** | `migration-lock.ts` | Concurrent execution prevention |
| **Migration Runner** | `migration-runner.ts` | Transactional execution |

---

## Safety Best Practices

1. **Always use dry-run first** - `yama plugin migrate --dry-run`
2. **Create backups before destructive ops** - The system warns you
3. **Test in staging** - Use environment flags
4. **Review safety analysis** - Pay attention to risk levels
5. **Use transactions** - Enabled by default for PostgreSQL
6. **Version your migrations** - Semver for plugins
7. **Use shadow columns** - Enabled by default for column drops
8. **Enable audit logging** - For compliance requirements
9. **Check database capabilities** - Know what your DB supports

---

## Example: Complete Migration Workflow

```bash
# 1. Check current status
yama schema status
yama plugin status

# 2. Make entity changes in yama.yaml
# ... edit entities ...

# 3. Generate migration (preview)
yama schema generate --preview

# 4. Generate migration (create files)
yama schema generate --name "add_user_roles"

# 5. Review safety analysis
# (shown automatically)

# 6. Apply to development
yama schema apply --env development

# 7. Test

# 8. Apply to staging (with backup)
yama backups create --env staging
yama schema apply --env staging

# 9. Apply to production (with confirmations)
yama schema apply --env production
```

---

## Future Roadmap

### Phase 2 (Planned)
- Table prefix sandboxing for plugins
- Automatic `pg_dump` backups before destructive ops
- Post-migration validation checks
- Full dry-run execution simulation

### Phase 3 (Planned)
- Permission system for database access
- AST-based SQL parsing
- Migration history UI
- One-click rollback

---

*This documentation was generated based on the Yama codebase version as of December 2024.*
