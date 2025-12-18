# @yamajs/storage-fs

Filesystem storage adapter for Yama.

## Installation

```bash
npm install @yamajs/storage-fs
# or
pnpm add @yamajs/storage-fs
# or
yarn add @yamajs/storage-fs
```

## Configuration

Add the plugin to your `yama.yaml`:

```yaml
plugins:
  "@yamajs/storage-fs":
    basePath: "./uploads"
    baseUrl: "https://example.com/uploads"  # Optional: for generating HTTP URLs
```

## Usage in Handlers

```typescript
export async function uploadFile(context: HandlerContext) {
  const file = context.body.file;
  const result = await context.storage.default.upload(
    `user-${context.auth.userId}/${Date.now()}.pdf`,
    file.buffer,
    { contentType: "application/pdf" }
  );
  return { url: result.url };
}

export async function getFile(context: HandlerContext) {
  const key = context.params.key;
  const file = await context.storage.default.download(key);
  return file;
}
```

## Features

- Upload/download files
- Delete files
- Check if file exists
- List files with prefix
- Get file URLs (file:// or http:// if baseUrl configured)
- Get file metadata
- Copy files
- Simple, no bucket configuration needed

## API

### StorageBucket Methods

- `upload(key, data, options?)` - Upload a file
- `download(key)` - Download a file
- `delete(key)` - Delete a file
- `exists(key)` - Check if file exists
- `getUrl(key, expiresIn?)` - Get file URL (expiresIn ignored for filesystem)
- `list(prefix?)` - List files with optional prefix
- `getMetadata(key)` - Get file metadata
- `copy(sourceKey, destKey)` - Copy a file

## Notes

- Files are stored in the `basePath` directory
- Paths are normalized to prevent directory traversal attacks
- The plugin creates a single "default" bucket for simplicity
- Access via `context.storage.default` in handlers

