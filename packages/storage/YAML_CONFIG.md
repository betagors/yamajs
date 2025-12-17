# Storage YAML Configuration Guide

## Overview

`@yamajs/storage` supports declarative configuration in `yama.yaml`, similar to how `database` is configured. This allows you to configure storage without writing code.

## Configuration Format

```yaml
# yama.yaml

storage:
  # Provider name (s3, local, gcs, azure, etc.)
  provider: s3
  
  # Bucket/container name
  bucket: my-app-uploads
  
  # Public CDN URL (optional)
  publicUrl: https://cdn.myapp.com
  
  # Default expiry for signed URLs in seconds (optional)
  defaultExpiry: 3600
  
  # Default options applied to all operations (optional)
  defaults:
    cacheControl: max-age=31536000
    contentType: application/octet-stream
    acl: public-read
  
  # Provider-specific options
  options:
    region: us-east-1
    credentials:
      accessKeyId: ${AWS_ACCESS_KEY_ID}
      secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
```

## Provider Registration

Before using storage from YAML config, you need to register the provider adapters. This is typically done in your app initialization:

```typescript
// app/init.ts or similar
import { registerStorageProvider } from '@yamajs/storage';
import { createS3Adapter } from '@yamajs/s3';
import { createLocalAdapter } from '@yamajs/storage-local'; // Future

// Register available providers
registerStorageProvider('s3', createS3Adapter);
registerStorageProvider('local', createLocalAdapter);
```

## Usage with Yama Framework

### Automatic Integration (Recommended)

If you're using the Yama framework, storage will be automatically initialized from config and added to context:

```typescript
// Yama automatically reads the config and creates storage
app.use(async (ctx, next) => {
  // ctx.storage is already available!
  await next();
});

// Use in routes
app.post('/upload', async (ctx) => {
  const file = await ctx.request.file();
  const result = await ctx.storage.put(`uploads/${file.name}`, file.data);
  ctx.body = { url: await ctx.storage.url(result.key) };
});
```

### Manual Integration

If you need to manually create storage from config:

```typescript
import { createStorageFromConfig } from '@yamajs/storage';
import { registerStorageProvider } from '@yamajs/storage';
import { createS3Adapter } from '@yamajs/s3';

// Register provider
registerStorageProvider('s3', createS3Adapter);

// Load config (however you do it)
const yamaConfig = loadYamaConfig();

// Create storage from config
const storage = createStorageFromConfig(yamaConfig.storage);

// Add to context
app.use(async (ctx, next) => {
  ctx.storage = storage;
  await next();
});
```

## Configuration Examples

### S3 Storage

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

### S3-Compatible (MinIO)

```yaml
storage:
  provider: s3
  bucket: uploads
  publicUrl: https://minio.myapp.local
  options:
    endpoint: http://localhost:9000
    region: us-east-1
    forcePathStyle: true
    credentials:
      accessKeyId: minioadmin
      secretAccessKey: minioadmin
```

### Local Filesystem (Future)

```yaml
storage:
  provider: local
  bucket: ./uploads  # Local directory
  publicUrl: /static/uploads
  options:
    baseUrl: http://localhost:3000
```

### Google Cloud Storage (Future)

```yaml
storage:
  provider: gcs
  bucket: my-gcs-bucket
  publicUrl: https://storage.googleapis.com/my-gcs-bucket
  options:
    projectId: ${GCP_PROJECT_ID}
    keyFilename: ${GCP_KEY_FILE}
```

### Azure Blob Storage (Future)

```yaml
storage:
  provider: azure
  bucket: mycontainer
  publicUrl: https://myaccount.blob.core.windows.net/mycontainer
  options:
    accountName: ${AZURE_STORAGE_ACCOUNT}
    accountKey: ${AZURE_STORAGE_KEY}
```

## Environment Variables

Use environment variables for sensitive data:

```yaml
storage:
  provider: s3
  bucket: ${STORAGE_BUCKET}
  publicUrl: ${STORAGE_CDN_URL}
  options:
    region: ${AWS_REGION}
    credentials:
      accessKeyId: ${AWS_ACCESS_KEY_ID}
      secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
```

```env
# .env
STORAGE_BUCKET=my-app-uploads
STORAGE_CDN_URL=https://cdn.myapp.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## Complete Example

```yaml
# yama.yaml
project:
  name: my-app
  version: 1.0.0

plugins:
  - "@yamajs/s3"

# Storage configuration
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

# Rest of your config...
schemas:
  User:
    fields:
      id: uuid!
      name: string!
      avatar: string?  # URL to uploaded avatar

operations:
  uploadAvatar:
    input:
      userId: uuid!
      file: binary!
    output: User
    handler: src/handlers/uploadAvatar.ts
```

```typescript
// src/handlers/uploadAvatar.ts
export async function uploadAvatar(ctx) {
  const { userId, file } = ctx.input;
  
  // Upload to storage (automatically configured from yama.yaml)
  const result = await ctx.storage.put(
    `avatars/${userId}.jpg`,
    file,
    { 
      contentType: 'image/jpeg',
      public: true 
    }
  );
  
  // Get URL
  const avatarUrl = await ctx.storage.url(result.key);
  
  // Update user
  const user = await ctx.db.User.update(userId, {
    avatar: avatarUrl
  });
  
  return user;
}
```

## Programmatic Access

Even when using YAML config, you can still access storage programmatically:

```typescript
import { 
  getStorageProvider,
  getRegisteredStorageProviders 
} from '@yamajs/storage';

// Check if a provider is registered
const s3Factory = getStorageProvider('s3');
if (s3Factory) {
  // Provider is available
}

// List all registered providers
const providers = getRegisteredStorageProviders();
console.log('Available providers:', providers);
// ['s3', 'local', 'gcs']
```

## Provider Registration via Plugins

Storage providers can also auto-register via plugins:

```typescript
// @yamajs/s3/src/plugin.ts
import { registerStorageProvider } from '@yamajs/storage';
import { createS3Adapter } from './adapter';

export default {
  name: '@yamajs/s3',
  
  async setup() {
    // Auto-register S3 provider
    registerStorageProvider('s3', createS3Adapter);
  }
};
```

Then in yama.yaml:

```yaml
plugins:
  - "@yamajs/s3"  # Automatically registers 's3' provider

storage:
  provider: s3  # Now available!
  bucket: my-bucket
```

## Schema Integration

Reference for future schema integration:

```yaml
schemas:
  Post:
    fields:
      id: uuid!
      title: string!
      content: text!
      coverImage: file(public: true, maxSize: 5MB)  # Future feature
      attachments: file[](maxSize: 10MB)            # Future feature
```

This would automatically use `ctx.storage` under the hood!

## Migration from Code-Based Config

### Before (Code)

```typescript
import { Storage } from '@yamajs/storage';
import { createS3Adapter } from '@yamajs/s3';

const storage = new Storage(
  createS3Adapter({
    region: 'us-east-1',
    bucket: 'my-bucket',
  }),
  {
    publicUrl: 'https://cdn.myapp.com',
    defaultExpiry: 3600,
  }
);
```

### After (YAML)

```yaml
storage:
  provider: s3
  bucket: my-bucket
  publicUrl: https://cdn.myapp.com
  defaultExpiry: 3600
  options:
    region: us-east-1
```

Much cleaner! ðŸŽ‰
