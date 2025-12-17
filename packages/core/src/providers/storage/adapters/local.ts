/**
 * Storage Provider - Local Adapter
 * 
 * Provides file storage on the local filesystem.
 * Zero external dependencies - uses Node.js built-in fs module.
 * 
 * Features:
 * - File upload with MIME type validation
 * - File download and streaming
 * - File metadata
 * - Directory listing
 * - Copy, move, delete operations
 */

import {
    existsSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    unlinkSync,
    copyFileSync,
    renameSync,
    statSync,
    readdirSync,
    createReadStream,
} from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { Readable } from 'node:stream';
import type {
    Provider,
    ProviderContext,
    StorageProviderConfig,
    StorageAPI,
    UploadOptions,
    UploadResult,
    FileInfo,
    FileMetadata,
} from '../../types.js';
import { registerAdapter } from '../../registry.js';

// ============================================================================
// File Size Parsing
// ============================================================================

/**
 * Parse file size string to bytes
 * Supports: 100 (bytes), 1KB, 1MB, 1GB
 */
function parseFileSize(size: string | number): number {
    if (typeof size === 'number') return size;

    const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
    if (!match) {
        throw new Error(`Invalid file size format: ${size}. Use: 100, 1KB, 10MB, 1GB`);
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    const multipliers: Record<string, number> = {
        B: 1,
        KB: 1024,
        MB: 1024 * 1024,
        GB: 1024 * 1024 * 1024,
        TB: 1024 * 1024 * 1024 * 1024,
    };

    return Math.floor(value * multipliers[unit]);
}

// ============================================================================
// MIME Type Matching
// ============================================================================

/**
 * Check if a MIME type matches a pattern
 * Patterns can be exact (image/png) or wildcard (image/*)
 */
function matchesMimeType(mimeType: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        if (pattern === '*' || pattern === '*/*') return true;

        if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -2);
            if (mimeType.startsWith(prefix + '/')) return true;
        } else if (pattern === mimeType) {
            return true;
        }
    }
    return false;
}

/**
 * Infer MIME type from file extension
 */
function getMimeType(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================================
// Local Storage API Implementation
// ============================================================================

class LocalStorageAPI implements StorageAPI {
    private basePath: string;
    private maxFileSize: number;
    private allowedTypes: string[] | null;
    private servePath: string | null;
    private logger: ProviderContext['log'];

    constructor(
        basePath: string,
        maxFileSize: number,
        allowedTypes: string[] | null,
        servePath: string | null,
        logger: ProviderContext['log']
    ) {
        this.basePath = basePath;
        this.maxFileSize = maxFileSize;
        this.allowedTypes = allowedTypes;
        this.servePath = servePath;
        this.logger = logger;

        // Ensure base directory exists
        if (!existsSync(basePath)) {
            mkdirSync(basePath, { recursive: true });
        }
    }

    private getFullPath(path: string): string {
        // Sanitize path to prevent directory traversal
        const sanitized = path.replace(/\.\./g, '').replace(/^\/+/, '');
        return join(this.basePath, sanitized);
    }

    async upload(
        data: Buffer | ReadableStream<Uint8Array> | string,
        path: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        const fullPath = this.getFullPath(path);
        const dir = dirname(fullPath);

        // Convert data to Buffer
        let buffer: Buffer;
        if (typeof data === 'string') {
            buffer = Buffer.from(data);
        } else if (Buffer.isBuffer(data)) {
            buffer = data;
        } else {
            // ReadableStream - collect chunks
            const chunks: Uint8Array[] = [];
            const reader = data.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            buffer = Buffer.concat(chunks);
        }

        // Check file size
        if (buffer.length > this.maxFileSize) {
            throw new Error(
                `File size ${buffer.length} exceeds maximum ${this.maxFileSize} bytes`
            );
        }

        // Check MIME type
        const contentType = options?.contentType || getMimeType(path);
        if (this.allowedTypes && !matchesMimeType(contentType, this.allowedTypes)) {
            throw new Error(
                `File type '${contentType}' is not allowed. ` +
                `Allowed types: ${this.allowedTypes.join(', ')}`
            );
        }

        // Check if file exists
        if (existsSync(fullPath) && !options?.overwrite) {
            throw new Error(`File already exists: ${path}. Set overwrite: true to replace.`);
        }

        // Create directory if needed
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        // Write file
        writeFileSync(fullPath, buffer);

        this.logger.debug('File uploaded', { path, size: buffer.length, contentType });

        // Generate URL
        const url = this.servePath
            ? `${this.servePath}/${path}`
            : `file://${fullPath}`;

        return {
            path,
            url,
            size: buffer.length,
            contentType,
        };
    }

    async download(path: string): Promise<Buffer> {
        const fullPath = this.getFullPath(path);

        if (!existsSync(fullPath)) {
            throw new Error(`File not found: ${path}`);
        }

        return readFileSync(fullPath);
    }

    async stream(path: string): Promise<ReadableStream<Uint8Array>> {
        const fullPath = this.getFullPath(path);

        if (!existsSync(fullPath)) {
            throw new Error(`File not found: ${path}`);
        }

        const nodeStream = createReadStream(fullPath);

        // Convert Node.js stream to Web ReadableStream
        return new ReadableStream({
            start(controller) {
                nodeStream.on('data', (chunk: Buffer | string) => {
                    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    controller.enqueue(new Uint8Array(buffer));
                });
                nodeStream.on('end', () => {
                    controller.close();
                });
                nodeStream.on('error', (err) => {
                    controller.error(err);
                });
            },
            cancel() {
                nodeStream.destroy();
            },
        });
    }

    async getUrl(path: string, expiresIn?: number): Promise<string> {
        const fullPath = this.getFullPath(path);

        if (!existsSync(fullPath)) {
            throw new Error(`File not found: ${path}`);
        }

        // For local storage, we just return the serve path
        // expiresIn is ignored for local storage (no signed URLs)
        if (this.servePath) {
            return `${this.servePath}/${path}`;
        }

        return `file://${fullPath}`;
    }

    async delete(path: string): Promise<void> {
        const fullPath = this.getFullPath(path);

        if (!existsSync(fullPath)) {
            return; // Already deleted
        }

        unlinkSync(fullPath);
        this.logger.debug('File deleted', { path });
    }

    async exists(path: string): Promise<boolean> {
        const fullPath = this.getFullPath(path);
        return existsSync(fullPath);
    }

    async list(prefix?: string): Promise<FileInfo[]> {
        const searchPath = prefix
            ? this.getFullPath(prefix)
            : this.basePath;

        if (!existsSync(searchPath)) {
            return [];
        }

        const stat = statSync(searchPath);
        if (!stat.isDirectory()) {
            // It's a file, return info about that file
            return [{
                path: prefix || '',
                size: stat.size,
                isDirectory: false,
                modifiedAt: stat.mtime,
            }];
        }

        const files: FileInfo[] = [];
        const items = readdirSync(searchPath, { withFileTypes: true });

        for (const item of items) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            const fullItemPath = join(searchPath, item.name);
            const itemStat = statSync(fullItemPath);

            files.push({
                path: itemPath,
                size: itemStat.size,
                isDirectory: item.isDirectory(),
                modifiedAt: itemStat.mtime,
            });
        }

        return files;
    }

    async getMetadata(path: string): Promise<FileMetadata | null> {
        const fullPath = this.getFullPath(path);

        if (!existsSync(fullPath)) {
            return null;
        }

        const stat = statSync(fullPath);

        return {
            path,
            size: stat.size,
            contentType: getMimeType(path),
            modifiedAt: stat.mtime,
        };
    }

    async copy(source: string, dest: string): Promise<void> {
        const sourcePath = this.getFullPath(source);
        const destPath = this.getFullPath(dest);

        if (!existsSync(sourcePath)) {
            throw new Error(`Source file not found: ${source}`);
        }

        // Create destination directory if needed
        const destDir = dirname(destPath);
        if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
        }

        copyFileSync(sourcePath, destPath);
        this.logger.debug('File copied', { source, dest });
    }

    async move(source: string, dest: string): Promise<void> {
        const sourcePath = this.getFullPath(source);
        const destPath = this.getFullPath(dest);

        if (!existsSync(sourcePath)) {
            throw new Error(`Source file not found: ${source}`);
        }

        // Create destination directory if needed
        const destDir = dirname(destPath);
        if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
        }

        renameSync(sourcePath, destPath);
        this.logger.debug('File moved', { source, dest });
    }
}

// ============================================================================
// Local Storage Provider
// ============================================================================

class LocalStorageProvider implements Provider<StorageProviderConfig, StorageAPI> {
    readonly type = 'storage' as const;
    readonly adapter = 'local';
    readonly version = '1.0.0';

    private api: LocalStorageAPI | null = null;

    async init(config: StorageProviderConfig, context: ProviderContext): Promise<StorageAPI> {
        // Determine storage path
        const basePath = config.path
            ? join(context.projectDir, config.path)
            : join(context.projectDir, 'uploads');

        // Parse max file size
        const maxFileSize = config.maxFileSize
            ? parseFileSize(config.maxFileSize)
            : 10 * 1024 * 1024; // 10MB default

        // Allowed types
        const allowedTypes = config.allowedTypes || null;

        // Serve path (for generating URLs)
        const servePath = config.serve?.enabled !== false
            ? config.serve?.path || '/uploads'
            : null;

        // Create API
        this.api = new LocalStorageAPI(
            basePath,
            maxFileSize,
            allowedTypes,
            servePath,
            context.log
        );

        context.log.info('Local storage provider initialized', {
            path: basePath,
            maxFileSize: `${Math.round(maxFileSize / 1024 / 1024)}MB`,
            servePath,
        });

        return this.api;
    }

    getAPI(): StorageAPI {
        if (!this.api) {
            throw new Error('Storage provider not initialized. Call init() first.');
        }
        return this.api;
    }

    isInitialized(): boolean {
        return this.api !== null;
    }

    async healthCheck() {
        if (!this.api) {
            return { healthy: false, error: 'Not initialized' };
        }

        return {
            healthy: true,
            details: {
                adapter: 'local',
            },
        };
    }

    // No shutdown needed for storage provider
}

// ============================================================================
// Register Adapter
// ============================================================================

registerAdapter('storage', 'local', () => new LocalStorageProvider());

// ============================================================================
// Exports
// ============================================================================

export { LocalStorageProvider, LocalStorageAPI };
export { parseFileSize, matchesMimeType, getMimeType };
