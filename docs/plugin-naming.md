# Plugin Naming Conventions

This document outlines the naming conventions for Yama packages and plugins.

## Package Naming Structure

### Core Packages
- **`@betagors/yama-core`** - Core types, interfaces, and utilities
- **`@betagors/yama-runtime-*`** - Runtime implementations
  - `@betagors/yama-runtime-node` - Node.js runtime
  - `@betagors/yama-runtime-bun` - Bun runtime (future)
  - `@betagors/yama-runtime-deno` - Deno runtime (future)

### Plugins
All installable packages that extend Yama functionality:
- **`@betagors/yama-*`** - User-installable plugins
  - `@betagors/yama-postgres` - PostgreSQL database plugin
  - `@betagors/yama-pglite` - PGLite database plugin
  - `@betagors/yama-http-fastify` - Fastify HTTP server plugin
  - `@betagors/yama-plugin-db-mysql` - MySQL database plugin (future)
  - `@betagors/yama-plugin-http-express` - Express HTTP server plugin (future)
  - `@betagors/yama-plugin-payments-stripe` - Stripe payments plugin (future)
  - `@betagors/yama-plugin-email-sendgrid` - SendGrid email plugin (future)
  - `@betagors/yama-plugin-storage-s3` - AWS S3 storage plugin (future)
  - `@betagors/yama-plugin-auth-clerk` - Clerk authentication plugin (future)

### Tools
Build-time utilities:
- **`@betagors/yama-*`** - Build-time tools
  - `@betagors/yama-docs-generator` - OpenAPI docs generator
  - `@betagors/yama-sdk` - TypeScript SDK generator
  - `@betagors/yama-sdk-js` - JavaScript SDK generator (future)

### CLI
- **`@betagors/yama-cli`** - Global CLI tool

## Plugin Package.json Metadata

All plugins must include `yama` metadata in their `package.json`:

```json
{
  "name": "@betagors/yama-postgres",
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

- `@betagors/yama-postgres` → `@betagors/yama-postgres` (already renamed)
- `@betagors/yama-http-fastify` - Fastify HTTP server adapter

These changes are optional and backward compatibility will be maintained.

