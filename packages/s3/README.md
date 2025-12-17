# @yamajs/s3

S3-compatible object storage adapter for Yama.

## Installation

```bash
npm install @yamajs/s3
# or
pnpm add @yamajs/s3
# or
yarn add @yamajs/s3
```

## Configuration

Add the plugin to your `yama.yaml`:

```yaml
plugins:
  "@yamajs/s3":
    region: "us-east-1"
    accessKeyId: "${AWS_ACCESS_KEY_ID}"
    secretAccessKey: "${AWS_SECRET_ACCESS_KEY}"
    endpoint: null  # Optional: for S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
    forcePathStyle: true  # Optional: for S3-compatible services
    buckets:
      images:
        name: "my-app-images"
        public: true
      documents:
        name: "my-app-docs"
        public: false
```

## Usage in Handlers

```typescript
export async function uploadImage(context: HandlerContext) {
  const file = context.body.file;
  const result = await context.storage.images.upload(
    `user-${context.auth.userId}/${Date.now()}.jpg`,
    file.buffer,
    { contentType: "image/jpeg" }
  );
  return { url: result.url };
}

export async function getImage(context: HandlerContext) {
  const key = context.params.key;
  const image = await context.storage.images.download(key);
  return image;
}
```

## Features

- Upload/download files
- Delete files
- Check if file exists
- List files with prefix
- Get signed URLs (for private buckets)
- Get file metadata
- Copy files
- Support for S3-compatible services (MinIO, DigitalOcean Spaces, etc.)

## API

### StorageBucket Methods

- `upload(key, data, options?)` - Upload a file
- `download(key)` - Download a file
- `delete(key)` - Delete a file
- `exists(key)` - Check if file exists
- `getUrl(key, expiresIn?)` - Get file URL (signed for private buckets)
- `list(prefix?)` - List files with optional prefix
- `getMetadata(key)` - Get file metadata
- `copy(sourceKey, destKey)` - Copy a file

