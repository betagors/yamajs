# @yamajs/storage

> Extensible, adapter-agnostic storage abstraction layer for Yama

`@yamajs/storage` provides a unified, future-proof API for file storage operations in Yama. It's designed to work with any storage backend (S3, local filesystem, etc.) through adapters, while supporting extensibility through hooks and plugins **without breaking changes**.

## Features

- âœ… **Adapter-agnostic** - Works with S3, local filesystem, or any storage backend
- âœ… **Extensible** - Hooks and plugin system for adding features without breaking changes
- âœ… **Smart URL generation** - Automatic CDN URL support for public assets
- âœ… **Type-safe** - Full TypeScript support
- âœ… **Future-proof** - Designed to evolve without breaking existing code
- âœ… **Minimal** - Small core API, extensions add advanced features

## Installation

```bash
pnpm add @yamajs/storage @yamajs/s3
```

## Quick Start

```typescript
import { Storage } from '@yamajs/storage';
import { createS3Adapter } from '@yamajs/s3';

// Create adapter
const s3Adapter = createS3Adapter({
  region: 'us-east-1',
  bucket: 'my-bucket',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Create storage instance
const storage = new Storage(s3Adapter);

// Upload a file
const result = await storage.put('avatar.jpg', buffer, {
  contentType: 'image/jpeg',
  public: true,
});

// Get a URL
const url = await storage.url('avatar.jpg');

// Download a file
const data = await storage.get('avatar.jpg');

// Delete a file
await storage.delete('avatar.jpg');

// Get metadata
const meta = await storage.stat('avatar.jpg');

// List files
for await (const key of storage.list({ prefix: 'uploads/' })) {
  console.log(key);
}
```

## YAML Configuration (Recommended)

Configure storage declaratively in your `yama.yaml`:

```yaml
storage:
  provider: s3
  bucket: my-app-uploads
  publicUrl: https://cdn.myapp.com
  defaultExpiry: 3600
  defaults:
    cacheControl: max-age=31536000
  options:
    region: us-east-1
    credentials:
      accessKeyId: ${AWS_ACCESS_KEY_ID}
      secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
```

Then register the provider and use it:

```typescript
import { registerStorageProvider, createStorageFromConfig } from '@yamajs/storage';
import { createS3Adapter } from '@yamajs/s3';

// Register provider (usually done by plugin)
registerStorageProvider('s3', createS3Adapter);

// Create storage from config
const storage = createStorageFromConfig(yamaConfig.storage);

// Or with Yama framework, it's automatic!
app.post('/upload', async (ctx) => {
  await ctx.storage.put('file.jpg', buffer); // ctx.storage is ready!
});
```

See [YAML_CONFIG.md](./YAML_CONFIG.md) for complete configuration guide.

## Core API

The core API is **stable** and will never break:

### `put(key, data, options?)`

Upload data to storage.

```typescript
await storage.put('file.jpg', buffer, {
  contentType: 'image/jpeg',
  public: true,
  cacheControl: 'max-age=31536000',
});
```

### `get(key)`

Download data from storage.

```typescript
const data = await storage.get('file.jpg');
```

### `url(key, options?)`

Get a URL for accessing the file. Automatically uses CDN URLs for public files if configured.

```typescript
// Public URL (uses CDN if configured)
const publicUrl = await storage.url('file.jpg', { public: true });

// Signed URL (expires in 1 hour)
const signedUrl = await storage.url('file.jpg', { expires: 3600 });
```

### `delete(key)`

Delete a file from storage.

```typescript
await storage.delete('file.jpg');
```

### `stat(key)`

Get metadata about a file.

```typescript
const meta = await storage.stat('file.jpg');
console.log(meta.size, meta.contentType, meta.lastModified);
```

### `list(options?)`

List files with optional prefix filter.

```typescript
for await (const key of storage.list({ prefix: 'avatars/' })) {
  console.log(key);
}
```

### `exists(key)`

Check if a file exists.

```typescript
if (await storage.exists('file.jpg')) {
  console.log('File exists');
}
```

### `copy(sourceKey, destKey)`

Copy a file to a new location.

```typescript
await storage.copy('file.jpg', 'backup/file.jpg');
```

## Configuration

```typescript
const storage = new Storage(adapter, {
  // Smart defaults applied to all operations
  defaults: {
    contentType: 'application/octet-stream',
    cacheControl: 'max-age=3600',
  },

  // CDN URL for public assets
  publicUrl: 'https://cdn.example.com',

  // Default expiry for signed URLs (seconds)
  defaultExpiry: 3600,
});
```

## Extensibility

### Hooks

Add behavior before/after storage operations without modifying the core API:

```typescript
// Log all uploads
storage.on('after:put', async ({ key, result }) => {
  console.log(`Uploaded ${key}, size: ${result.size} bytes`);
});

// Validate before upload
storage.on('before:put', async ({ key, data, options }) => {
  if (options.contentType?.startsWith('video/')) {
    throw new Error('Video uploads not allowed');
  }
});

// Available hooks:
// - before:put, after:put
// - before:get, after:get
// - before:delete, after:delete
// - before:url, after:url
// - before:stat, after:stat
// - before:list, after:list
```

### Extensions/Plugins

Add new methods and features without breaking the core API:

```typescript
// CDN purge extension
const cdnExtension = {
  name: 'cdn-purge',

  async purgeCache(key: string) {
    await fetch(`https://cdn.example.com/purge/${key}`, {
      method: 'POST',
    });
  },

  setup(storage: Storage) {
    // Auto-purge after every upload
    storage.on('after:put', async ({ key }) => {
      await this.purgeCache(key);
    });
  },
};

// Register extension
storage.use(cdnExtension);

// Now you can call the new method!
await storage.purgeCache('file.jpg');
```

## Smart CDN URLs

When `publicUrl` is configured, `storage.url()` automatically returns CDN URLs for public files:

```typescript
const storage = new Storage(s3Adapter, {
  publicUrl: 'https://cdn.example.com',
});

// Returns: https://cdn.example.com/file.jpg
await storage.url('file.jpg', { public: true });

// Signed URL (ignores publicUrl)
await storage.url('file.jpg', { expires: 3600 });
```

## Using with Yama Context

```typescript
import { Yama } from '@yamajs/core';
import { Storage } from '@yamajs/storage';
import { createS3Adapter } from '@yamajs/s3';

const app = new Yama();

// Create storage instance
const storage = new Storage(
  createS3Adapter({
    region: 'us-east-1',
    bucket: 'my-bucket',
  })
);

// Add to context
app.use(async (ctx, next) => {
  ctx.storage = storage;
  await next();
});

// Use in routes
app.post('/upload', async (ctx) => {
  const file = await ctx.request.file();
  const result = await ctx.storage.put(`uploads/${file.name}`, file.data);
  ctx.body = { url: await ctx.storage.url(result.key) };
});
```

## Future Features (Non-Breaking)

The design allows these features to be added later without breaking existing code:

- **Optimistic uploads** - Return immediately, upload in background
- **Multi-storage** - Array of storage instances with routing
- **Model attachments** - `file()` field type that uses storage internally
- **Batch operations** - Upload/delete multiple files efficiently
- **Image transformations** - Resize, crop, etc. via extensions
- **Progress tracking** - Upload/download progress events

All of these can be added without changing the core API you use today!

## Adapters

Storage works with any adapter that implements the `StorageAdapter` interface:

- **[@yamajs/s3](../s3)** - S3-compatible storage (S3, MinIO, etc.)
- **@yamajs/storage-local** _(coming soon)_ - Local filesystem
- **@yamajs/storage-gcs** _(coming soon)_ - Google Cloud Storage
- **@yamajs/storage-azure** _(coming soon)_ - Azure Blob Storage

### Creating a Custom Adapter

```typescript
import type { StorageAdapter } from '@yamajs/storage';

const myAdapter: StorageAdapter = {
  async upload(key, data, options) {
    // Upload implementation
    return { key, size: data.length };
  },
  async download(key) {
    // Download implementation
    return Buffer.from('...');
  },
  async delete(key) {
    // Delete implementation
  },
  async exists(key) {
    // Check existence
    return true;
  },
  async getUrl(key, expiresIn) {
    // Generate URL
    return `https://example.com/${key}`;
  },
  async list(prefix) {
    // List files
    return ['file1.jpg', 'file2.jpg'];
  },
  async getMetadata(key) {
    // Get metadata
    return { key, size: 1024, contentType: 'image/jpeg' };
  },
  async copy(sourceKey, destKey) {
    // Copy file
  },
};

const storage = new Storage(myAdapter);
```

## API Stability

The core Storage API (`put`, `get`, `url`, `delete`, `stat`, `list`, `exists`, `copy`) is **stable** and will not break in future versions.

New features will be added through:
1. **New optional parameters** (backwards compatible)
2. **Hooks** (opt-in)
3. **Extensions** (opt-in)
4. **Configuration options** (opt-in)

Your existing code will continue to work even as the library evolves.

## License

MPL-2.0

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) first.
