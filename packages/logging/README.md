# @betagors/yama-logging

Structured logging plugin for Yama with support for console, file, and S3 transports.

## Installation

```bash
npm install @betagors/yama-logging
# or
pnpm add @betagors/yama-logging
# or
yarn add @betagors/yama-logging
```

## Configuration

Add the plugin to your `yama.yaml`:

```yaml
plugins:
  "@betagors/yama-logging":
    level: "info"  # debug, info, warn, error
    transports:
      - type: "console"
        format: "text"  # or "json"
      - type: "file"
        path: "logs/app.log"
        format: "json"
        rotation:
          enabled: true
          maxSize: "10MB"
          maxFiles: 7
      - type: "s3"
        bucket: "logs"
        prefix: "app/"
        format: "json"
        batchSize: 100
```

### Transport Types

#### Console Transport
Always available, no dependencies required.

```yaml
- type: "console"
  format: "text"  # or "json"
```

#### File Transport
Requires `@betagors/yama-fs` plugin to be installed and configured.

```yaml
- type: "file"
  path: "logs/app.log"
  format: "json"  # or "text"
  rotation:
    enabled: true
    maxSize: "10MB"  # Size-based rotation
    maxFiles: 7      # Keep last N files
```

#### S3 Transport
Requires `@betagors/yama-s3` plugin to be installed and configured.

```yaml
- type: "s3"
  bucket: "logs"      # Bucket alias from s3 plugin config
  prefix: "app/"       # Prefix for log files in S3
  format: "json"       # or "text"
  batchSize: 100       # Number of logs to batch before upload
```

## Usage in Handlers

```typescript
export async function myHandler(context: HandlerContext) {
  const logger = context.services.logger;
  
  logger.debug("Debug message", { userId: context.auth.userId });
  logger.info("Info message", { action: "create" });
  logger.warn("Warning message", { resource: "file" });
  logger.error("Error message", { error: err });
  
  return { success: true };
}
```

## Usage in Plugins

```typescript
import type { PluginContext } from "@betagors/yama-core";

async init(opts: Record<string, unknown>, context: PluginContext) {
  const logger = context.getService("logger");
  
  if (logger) {
    logger.info("Plugin initialized");
  }
  
  return { /* plugin API */ };
}
```

## Features

- Multiple log levels: debug, info, warn, error
- Multiple transports: console, file, S3
- Multiple formats: JSON, text
- Log rotation for file transport
- Batching for S3 transport
- Graceful degradation (works with console only if other plugins unavailable)
- Structured logging with metadata support
- Error stack trace capture

## Log Levels

- `debug` - Detailed debugging information
- `info` - General informational messages
- `warn` - Warning messages
- `error` - Error messages

Only logs at or above the configured level will be output.

## Formats

### Text Format
Human-readable format:
```
[2024-01-01T12:00:00.000Z] INFO: User logged in { userId: "123" }
```

### JSON Format
Structured JSON format:
```json
{"timestamp":"2024-01-01T12:00:00.000Z","level":"info","message":"User logged in","metadata":{"userId":"123"}}
```

## Notes

- Console transport is always available
- File transport requires `@betagors/yama-fs` plugin
- S3 transport requires `@betagors/yama-s3` plugin
- If optional plugins are not available, those transports are skipped gracefully
- Logger is registered as a service and accessible via `context.getService('logger')`
- Logs are buffered/batched for performance in file and S3 transports



















