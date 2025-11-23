# Plugin Naming Conventions

This document outlines the naming conventions for Yama packages and plugins.

## Package Naming Structure

### Core Packages
- **`@yama/core`** - Core types, interfaces, and utilities
- **`@yama/runtime-*`** - Runtime implementations
  - `@yama/runtime-node` - Node.js runtime
  - `@yama/runtime-bun` - Bun runtime (future)
  - `@yama/runtime-deno` - Deno runtime (future)

### Plugins
All installable packages that extend Yama functionality:
- **`@yama/plugin-*`** - User-installable plugins
  - `@yama/postgres` - PostgreSQL database plugin
  - `@yama/plugin-db-mysql` - MySQL database plugin (future)
  - `@yama/plugin-http-fastify` - Fastify HTTP server plugin
  - `@yama/plugin-http-express` - Express HTTP server plugin (future)
  - `@yama/plugin-payments-stripe` - Stripe payments plugin (future)
  - `@yama/plugin-email-sendgrid` - SendGrid email plugin (future)
  - `@yama/plugin-storage-s3` - AWS S3 storage plugin (future)
  - `@yama/plugin-auth-clerk` - Clerk authentication plugin (future)

### Tools
Build-time utilities:
- **`@yama/tool-*`** - Build-time tools
  - `@yama/tool-docs-generator` - OpenAPI docs generator
  - `@yama/sdk` - TypeScript SDK generator
  - `@yama/tool-sdk-js` - JavaScript SDK generator (future)

### CLI
- **`@yama/cli`** - Global CLI tool

## Plugin Package.json Metadata

All plugins must include `yama` metadata in their `package.json`:

```json
{
  "name": "@yama/postgres",
  "version": "0.0.1",
  "yama": {
    "pluginApi": "1.0",
    "yamaCore": "^0.1.0",
    "category": "database",
    "entryPoint": "./dist/plugin.js"
  }
}
```

### Metadata Fields

- **`pluginApi`** (optional but recommended): Plugin API version (e.g., "1.0")
- **`yamaCore`** (optional but recommended): Compatible Yama core version (e.g., "^0.1.0")
- **`category`** (optional): Plugin category (e.g., "database", "payments", "email")
- **`entryPoint`** (optional): Entry point file (default: "./dist/plugin.js")

## Plugin Interface

Plugins must implement the `YamaPlugin` interface:

```typescript
export interface YamaPlugin {
  name: string;
  version?: string;
  category?: string;
  pluginApi?: string;
  yamaCore?: string;
  manifest?: PluginManifest;
  
  init(opts?: Record<string, unknown>): Promise<any>;
  
  // Optional lifecycle hooks
  onInit?(config: Record<string, unknown>): Promise<void> | void;
  onStart?(): Promise<void> | void;
  onStop?(): Promise<void> | void;
  onError?(error: Error): void;
}
```

## Migration from Old Names

The following packages may be renamed in the future to follow the new convention:

- `@yama/postgres` → `@yama/postgres` (already renamed)
- `@yama/http-fastify` → `@yama/plugin-http-fastify`

These changes are optional and backward compatibility will be maintained.

