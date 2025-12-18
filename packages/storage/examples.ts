/**
 * Example usage of @yamajs/storage with S3
 * 
 * This example demonstrates the core Storage API and extensibility features.
 */

import { Storage } from '@yamajs/storage';
import { createS3Adapter } from '@yamajs/s3';

// ============================================================
// Example 1: Basic Usage
// ============================================================

async function basicUsage() {
    // Create S3 adapter
    const s3Adapter = createS3Adapter({
        region: 'us-east-1',
        bucket: 'my-bucket',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    // Create storage instance
    const storage = new Storage(s3Adapter);

    // Upload a file
    const fileBuffer = Buffer.from('Hello, World!');
    const result = await storage.put('greeting.txt', fileBuffer, {
        contentType: 'text/plain',
        public: true,
    });

    console.log('Uploaded:', result);

    // Get a URL
    const url = await storage.url('greeting.txt');
    console.log('URL:', url);

    // Download the file
    const data = await storage.get('greeting.txt');
    console.log('Content:', (data as Buffer).toString());

    // Get metadata
    const meta = await storage.stat('greeting.txt');
    console.log('Size:', meta?.size, 'bytes');

    // List files
    for await (const key of storage.list({ prefix: 'greet' })) {
        console.log('Found:', key);
    }

    // Delete the file
    await storage.delete('greeting.txt');
}

// ============================================================
// Example 2: CDN Configuration
// ============================================================

async function cdnConfiguration() {
    const s3Adapter = createS3Adapter({
        region: 'us-east-1',
        bucket: 'my-bucket',
        public: true,
    });

    // Configure storage with CDN
    const storage = new Storage(s3Adapter, {
        publicUrl: 'https://cdn.example.com',
        defaultExpiry: 3600,
        defaults: {
            cacheControl: 'max-age=31536000',
        },
    });

    // This will use CDN URL
    await storage.put('logo.png', Buffer.from('...'), { public: true });
    const publicUrl = await storage.url('logo.png', { public: true });
    // Returns: https://cdn.example.com/logo.png

    // This will use signed URL
    const signedUrl = await storage.url('private.pdf', { expires: 600 });
    // Returns: https://s3.amazonaws.com/my-bucket/private.pdf?...
}

// ============================================================
// Example 3: Hooks for Logging
// ============================================================

async function hooksForLogging() {
    const storage = new Storage(createS3Adapter({ bucket: 'my-bucket' }));

    // Log all uploads
    storage.on('after:put', async ({ key, result }) => {
        console.log(`âœ… Uploaded ${key} (${result.size} bytes)`);
    });

    // Log all downloads
    storage.on('before:get', async ({ key }) => {
        console.log(`ðŸ“¥ Downloading ${key}...`);
    });

    // Log all deletions
    storage.on('after:delete', async ({ key }) => {
        console.log(`ðŸ—‘ï¸  Deleted ${key}`);
    });

    // Now all operations are logged
    await storage.put('file.txt', Buffer.from('test'));
    await storage.get('file.txt');
    await storage.delete('file.txt');
}

// ============================================================
// Example 4: Validation Hook
// ============================================================

async function validationHook() {
    const storage = new Storage(createS3Adapter({ bucket: 'my-bucket' }));

    // Validate file types
    storage.on('before:put', async ({ key, options }) => {
        const contentType = (options as any)?.contentType;

        // Block executable files
        if (contentType?.includes('application/x-executable')) {
            throw new Error('Executable files are not allowed');
        }

        // Enforce image size limits (would need to check buffer size)
        if (contentType?.startsWith('image/')) {
            // Validation logic...
        }
    });

    // This will throw an error
    try {
        await storage.put('malware.exe', Buffer.from('...'), {
            contentType: 'application/x-executable',
        });
    } catch (err) {
        console.error('Upload rejected:', err.message);
    }
}

// ============================================================
// Example 5: CDN Purge Extension
// ============================================================

async function cdnPurgeExtension() {
    // Create a CDN purge extension
    const cdnPurge = {
        name: 'cdn-purge',

        async purgeCache(key: string) {
            console.log(`Purging CDN cache for ${key}`);
            await fetch(`https://cdn.example.com/api/purge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: [key] }),
            });
        },

        setup(storage: Storage) {
            // Auto-purge after every upload
            storage.on('after:put', async ({ key }) => {
                await this.purgeCache(key!);
            });

            // Auto-purge after every delete
            storage.on('after:delete', async ({ key }) => {
                await this.purgeCache(key!);
            });
        },
    };

    // Use the extension
    const storage = new Storage(createS3Adapter({ bucket: 'my-bucket' }));
    storage.use(cdnPurge);

    // Uploading will trigger CDN purge
    await storage.put('image.jpg', Buffer.from('...'));

    // You can also call the extension method directly
    await (storage as any).purgeCache('other-file.jpg');
}

// ============================================================
// Example 6: Analytics Extension
// ============================================================

async function analyticsExtension() {
    const analytics = {
        name: 'analytics',
        stats: {
            uploads: 0,
            downloads: 0,
            deletes: 0,
            totalBytes: 0,
        },

        getStats() {
            return { ...this.stats };
        },

        reset() {
            this.stats = {
                uploads: 0,
                downloads: 0,
                deletes: 0,
                totalBytes: 0,
            };
        },

        setup(storage: Storage) {
            storage.on('after:put', async ({ result }) => {
                this.stats.uploads++;
                this.stats.totalBytes += result.size || 0;
            });

            storage.on('after:get', async () => {
                this.stats.downloads++;
            });

            storage.on('after:delete', async () => {
                this.stats.deletes++;
            });
        },
    };

    const storage = new Storage(createS3Adapter({ bucket: 'my-bucket' }));
    storage.use(analytics);

    // Perform operations
    await storage.put('file1.txt', Buffer.from('Hello'));
    await storage.put('file2.txt', Buffer.from('World'));
    await storage.get('file1.txt');
    await storage.delete('file2.txt');

    // Get statistics
    const stats = (storage as any).getStats();
    console.log('Analytics:', stats);
    // { uploads: 2, downloads: 1, deletes: 1, totalBytes: 10 }
}

// ============================================================
// Example 7: Multi-Storage with Routing
// ============================================================

async function multiStorage() {
    // Different storage for different use cases
    const publicStorage = new Storage(
        createS3Adapter({ bucket: 'public-assets' }),
        { publicUrl: 'https://cdn.example.com' }
    );

    const privateStorage = new Storage(
        createS3Adapter({ bucket: 'private-files' }),
        { defaultExpiry: 300 }
    );

    // User uploads
    async function handleUserUpload(file: Buffer, isPublic: boolean) {
        const storage = isPublic ? publicStorage : privateStorage;
        return await storage.put(`uploads/${Date.now()}.jpg`, file, {
            contentType: 'image/jpeg',
            public: isPublic,
        });
    }

    // Usage
    await handleUserUpload(Buffer.from('...'), true); // Uses CDN
    await handleUserUpload(Buffer.from('...'), false); // Uses signed URLs
}

// ============================================================
// Example 8: Yama Context Integration
// ============================================================

// In your Yama app
async function yamaIntegration() {
    const { Yama } = await import('@yamajs/kernel');

    const app = new Yama();

    // Create storage instance
    const storage = new Storage(
        createS3Adapter({
            bucket: 'my-app-uploads',
            region: 'us-east-1',
        }),
        {
            publicUrl: 'https://cdn.myapp.com',
        }
    );

    // Add storage to context
    app.use(async (ctx: any, next: any) => {
        ctx.storage = storage;
        await next();
    });

    // Use in routes
    app.post('/upload', async (ctx: any) => {
        const file = await ctx.request.file();

        // Upload to storage
        const result = await ctx.storage.put(
            `uploads/${ctx.userId}/${file.name}`,
            file.data,
            {
                contentType: file.type,
                public: true,
            }
        );

        // Return URL
        ctx.body = {
            success: true,
            url: await ctx.storage.url(result.key),
        };
    });

    app.get('/files/:key', async (ctx: any) => {
        const { key } = ctx.params;

        // Check if file exists
        if (!(await ctx.storage.exists(key))) {
            ctx.status = 404;
            ctx.body = { error: 'File not found' };
            return;
        }

        // Get signed URL
        const url = await ctx.storage.url(key, { expires: 3600 });

        // Redirect to file
        ctx.redirect(url);
    });

    app.delete('/files/:key', async (ctx: any) => {
        const { key } = ctx.params;

        // Delete file
        await ctx.storage.delete(key);

        ctx.body = { success: true };
    });
}

// ============================================================
// Example 9: Image Processing Extension (Future)
// ============================================================

async function imageProcessingExtension() {
    // This is a future extension that could be built
    const imageProcessor = {
        name: 'image-processor',

        async resize(key: string, width: number, height: number) {
            // Download original
            const storage = this.storage as Storage;
            const data = await storage.get(key);

            // Process image (using sharp or similar)
            // const processed = await sharp(data).resize(width, height).toBuffer();

            // Upload processed version
            const newKey = key.replace(/(\.[^.]+)$/, `-${width}x${height}$1`);
            // await storage.put(newKey, processed);

            return newKey;
        },

        storage: null as Storage | null,

        setup(storage: Storage) {
            this.storage = storage;
        },
    };

    const storage = new Storage(createS3Adapter({ bucket: 'images' }));
    storage.use(imageProcessor);

    // Upload original
    await storage.put('photo.jpg', Buffer.from('...'));

    // Create thumbnail
    const thumbnailKey = await (storage as any).resize('photo.jpg', 200, 200);
    console.log('Thumbnail:', thumbnailKey); // photo-200x200.jpg
}

// ============================================================
// Run examples
// ============================================================

// Uncomment to run specific examples
// basicUsage().catch(console.error);
// cdnConfiguration().catch(console.error);
// hooksForLogging().catch(console.error);
// validationHook().catch(console.error);
// cdnPurgeExtension().catch(console.error);
// analyticsExtension().catch(console.error);
// multiStorage().catch(console.error);
// yamaIntegration().catch(console.error);
// imageProcessingExtension().catch(console.error);

export {
    basicUsage,
    cdnConfiguration,
    hooksForLogging,
    validationHook,
    cdnPurgeExtension,
    analyticsExtension,
    multiStorage,
    yamaIntegration,
    imageProcessingExtension,
};
