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

#### Database Plugins
  - `@betagors/yama-postgres` - PostgreSQL database plugin
  - `@betagors/yama-pglite` - PGLite database plugin
  - `@betagors/yama-mysql` - MySQL/MariaDB database plugin (planned)
  - `@betagors/yama-sqlite` - SQLite database plugin (planned)

#### HTTP Server Plugins
  - `@betagors/yama-fastify` - Fastify HTTP server plugin
  - `@betagors/yama-http-express` - Express HTTP server plugin (planned)

#### Storage Plugins
  - `@betagors/yama-s3` - S3-compatible object storage plugin
  - `@betagors/yama-fs` - Filesystem storage plugin

#### Cache Plugins
  - `@betagors/yama-redis` - Redis cache plugin
  - `@betagors/yama-cache-memcached` - Memcached cache plugin (planned)
  - `@betagors/yama-cache-cloudflare` - Cloudflare KV cache plugin (planned)

#### Observability Plugins
  - `@betagors/yama-logging` - Structured logging plugin (planned)
  - `@betagors/yama-metrics` - Metrics and telemetry plugin (planned)
  - `@betagors/yama-tracing` - Distributed tracing plugin (planned)
  - `@betagors/yama-error-tracking` - Error tracking plugin (planned)
  - `@betagors/yama-health` - Enhanced health checks plugin (planned)

#### Email Plugins
  - `@betagors/yama-email-sendgrid` - SendGrid email plugin (planned)
  - `@betagors/yama-email-resend` - Resend email plugin (planned)
  - `@betagors/yama-email-ses` - AWS SES email plugin (planned)
  - `@betagors/yama-email-smtp` - Generic SMTP email plugin (planned)

#### Payment Plugins
  - `@betagors/yama-payments-stripe` - Stripe payments plugin (planned)
  - `@betagors/yama-payments-paypal` - PayPal payments plugin (planned)

#### Authentication Plugins
  - `@betagors/yama-auth-oauth` - OAuth providers plugin (planned)
  - `@betagors/yama-auth-clerk` - Clerk authentication plugin (planned)
  - `@betagors/yama-auth-auth0` - Auth0 authentication plugin (planned)
  - `@betagors/yama-auth-supabase` - Supabase authentication plugin (planned)

#### Queue & Job Processing Plugins
  - `@betagors/yama-queue-bullmq` - BullMQ job queue plugin (planned)
  - `@betagors/yama-queue-bull` - Bull job queue plugin (planned)
  - `@betagors/yama-queue-sqs` - AWS SQS queue plugin (planned)

#### Security Plugins
  - `@betagors/yama-security` - Security middleware plugin (planned)

#### Realtime Plugins
  - `@betagors/yama-realtime` - Realtime/WebSocket plugin
  - `@betagors/yama-realtime-client` - Realtime client SDK

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
- `@betagors/yama-fastify` - Fastify HTTP server adapter

These changes are optional and backward compatibility will be maintained.

