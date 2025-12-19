import type {
    Provider,
    ProviderContext,
    StorageProviderConfig,
    StorageAPI,
    UploadOptions,
    UploadResult,
    FileInfo,
    FileMetadata,
} from '@yamajs/kernel';
import { registerAdapter } from '@yamajs/kernel';
import {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    CopyObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { extname } from "path";

// ============================================================================
// S3 Storage API Implementation
// ============================================================================

export class S3StorageAPI implements StorageAPI {
    private client: S3Client;
    private bucket: string;
    private region: string;
    private endpoint: string | undefined;
    private logger: ProviderContext['log'];
    private public: boolean;

    constructor(
        // We take the config directly or individual params? 
        // Provider pattern usually passes context.
        config: NonNullable<StorageProviderConfig['s3']>,
        logger: ProviderContext['log']
    ) {
        this.bucket = config.bucket;
        this.region = config.region;
        this.endpoint = config.endpoint;
        this.logger = logger;
        this.public = false; // Default to private unless configured otherwise

        this.client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
            },
            endpoint: this.endpoint,
            forcePathStyle: !!this.endpoint, // Often needed for custom endpoints like MinIO
        });
    }

    async upload(
        data: Buffer | ReadableStream<Uint8Array> | string,
        path: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        let body: Buffer | Readable;

        if (typeof data === 'string') {
            body = Buffer.from(data);
        } else if (Buffer.isBuffer(data)) {
            body = data;
        } else {
            // ReadableStream -> Buffer (simplest for now, though streaming upload is better for large files)
            // For true streaming we'd need lib-storage Upload
            const chunks: Uint8Array[] = [];
            const reader = data.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            body = Buffer.concat(chunks);
        }

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: path,
            Body: body,
            ContentType: options?.contentType || this.getMimeType(path),
            Metadata: options?.metadata,
            ContentDisposition: options?.contentDisposition,
            // Map legacy ACL or guess
            ACL: (options as any)?.acl || (this.public ? "public-read" : "private"),
        });

        const response = await this.client.send(command);

        // Generate URL
        const url = await this.getUrl(path);

        return {
            path,
            url,
            size: body.length,
            contentType: options?.contentType,
            etag: response.ETag,
        };
    }

    async download(path: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: path,
        });

        const response = await this.client.send(command);

        if (!response.Body) {
            throw new Error(`File not found or empty: ${path}`);
        }

        // Convert stream to Buffer
        // AWS SDK v3 returns a specialized stream
        const stream = response.Body as unknown as Readable;
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
            stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
            stream.on("error", reject);
        });
    }

    async stream(path: string): Promise<ReadableStream<Uint8Array>> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: path,
        });

        const response = await this.client.send(command);

        if (!response.Body) {
            throw new Error(`File not found or empty: ${path}`);
        }

        const nodeStream = response.Body as unknown as Readable;

        return new ReadableStream({
            start(controller) {
                nodeStream.on('data', (chunk) => {
                    controller.enqueue(new Uint8Array(Buffer.from(chunk)));
                });
                nodeStream.on('end', () => controller.close());
                nodeStream.on('error', (err) => controller.error(err));
            }
        });
    }

    async getUrl(path: string, expiresIn?: number): Promise<string> {
        if (this.public && !expiresIn) {
            // Public URL
            const endpoint = this.endpoint || `https://s3.${this.region}.amazonaws.com`;
            // Handle path style vs domain style if needed, simplistic for now
            return `${endpoint}/${this.bucket}/${path}`;
        }

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: path,
        });

        return getSignedUrl(this.client, command, { expiresIn: expiresIn || 3600 });
    }

    async delete(path: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: path,
        });
        await this.client.send(command);
        this.logger.debug('S3 file deleted', { path });
    }

    async exists(path: string): Promise<boolean> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: path,
            });
            await this.client.send(command);
            return true;
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    async list(prefix?: string): Promise<FileInfo[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
        });

        const response = await this.client.send(command);
        const files: FileInfo[] = [];

        if (response.Contents) {
            for (const item of response.Contents) {
                if (item.Key) {
                    files.push({
                        path: item.Key,
                        size: item.Size || 0,
                        isDirectory: item.Key.endsWith('/'),
                        modifiedAt: item.LastModified || new Date(),
                    });
                }
            }
        }

        return files;
    }

    async getMetadata(path: string): Promise<FileMetadata | null> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: path,
            });
            const response = await this.client.send(command);

            return {
                path,
                size: response.ContentLength || 0,
                contentType: response.ContentType,
                modifiedAt: response.LastModified || new Date(),
                metadata: response.Metadata,
            };
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return null;
            }
            throw error;
        }
    }

    async copy(source: string, dest: string): Promise<void> {
        const command = new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${source}`,
            Key: dest,
        });
        await this.client.send(command);
    }

    async move(source: string, dest: string): Promise<void> {
        await this.copy(source, dest);
        await this.delete(source);
    }

    private getMimeType(filename: string): string {
        const ext = extname(filename).toLowerCase();
        // Basic mapping, could import from utils but keeping self-contained for now or duplicate minimal
        const mimeTypes: Record<string, string> = {
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.ids': 'application/json',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            // ... extend as needed
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

// ============================================================================
// S3 Provider Factory
// ============================================================================

export class S3StorageProvider implements Provider<StorageProviderConfig, StorageAPI> {
    readonly type = 'storage' as const;
    readonly adapter = 's3';
    readonly version = '1.0.0';

    private api: S3StorageAPI | null = null;

    async init(config: StorageProviderConfig, context: ProviderContext): Promise<StorageAPI> {
        if (!config.s3) {
            throw new Error('S3 provider requires "s3" configuration section');
        }

        this.api = new S3StorageAPI(config.s3, context.log);

        context.log.info('S3 storage provider initialized', {
            bucket: config.s3.bucket,
            region: config.s3.region
        });

        return this.api;
    }

    getAPI(): StorageAPI {
        if (!this.api) {
            throw new Error('S3 Storage provider not initialized');
        }
        return this.api;
    }

    isInitialized(): boolean {
        return this.api !== null;
    }

    async healthCheck() {
        if (!this.api) return { healthy: false, error: 'Not initialized' };
        // Could do a HeadBucket here
        return { healthy: true, details: { adapter: 's3' } };
    }
}

// Register as 's3'
registerAdapter('storage', 's3', () => new S3StorageProvider());
