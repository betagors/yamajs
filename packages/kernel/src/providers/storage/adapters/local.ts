
/**
 * Storage Provider - Local/FileSystem Adapter
 * 
 * Provides file storage on the local filesystem.
 * Uses RuntimeAdapter for file operations.
 */

import { getRuntime } from '../../../platform/index.js';
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

// Helper to get fs/path
const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

// ============================================================================
// File Size Parsing
// ============================================================================

/**
 * Parse file size string to bytes
 * Supports: 100 (bytes), 1KB, 1MB, 1GB
 */
export function parseFileSize(size: string | number): number {
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
 */
export function matchesMimeType(mimeType: string, patterns: string[]): boolean {
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
export function getMimeType(filename: string): string {
    const ext = path().extname(filename).toLowerCase();
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
// FileSystem Storage API Implementation
// ============================================================================

export class LocalStorageAPI implements StorageAPI {
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
    }

    async init() {
        if (!(await fs().exists(this.basePath))) {
            await fs().mkdir(this.basePath);
        }
    }

    private getFullPath(filePath: string): string {
        // Sanitize path to prevent directory traversal
        const sanitized = filePath.replace(/\.\./g, '').replace(/^\/+/, '');
        return path().join(this.basePath, sanitized);
    }

    async upload(
        data: Uint8Array | ReadableStream<Uint8Array> | string,
        filePath: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        const fullPath = this.getFullPath(filePath);

        // Convert data to Uint8Array
        let buffer: Uint8Array;
        if (typeof data === 'string') {
            buffer = new TextEncoder().encode(data);
        } else if (data instanceof Uint8Array) { // Buffer is Uint8Array
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
            // Concat chunks
            const totalLength = chunks.reduce((acc, val) => acc + val.length, 0);
            buffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
            }
        }

        // Check file size
        if (buffer.length > this.maxFileSize) {
            throw new Error(
                `File size ${buffer.length} exceeds maximum ${this.maxFileSize} bytes`
            );
        }

        // Check MIME type
        const contentType = options?.contentType || getMimeType(filePath);
        if (this.allowedTypes && !matchesMimeType(contentType, this.allowedTypes)) {
            throw new Error(
                `File type '${contentType}' is not allowed. ` +
                `Allowed types: ${this.allowedTypes.join(', ')}`
            );
        }

        // Check if file exists
        if ((await fs().exists(fullPath)) && !options?.overwrite) {
            throw new Error(`File already exists: ${filePath}. Set overwrite: true to replace.`);
        }

        // Create directory if needed handling is done by writeTextFile/writeFile in RuntimeAdapter
        // But writeTextFile/writeFile logic in RuntimeAdapter handles parent dir creation?
        // Yes, my implementation in NodeRuntime does helper mkdir.

        // Write file
        await fs().writeFile(fullPath, buffer);

        this.logger.debug('File uploaded', { path: filePath, size: buffer.length, contentType });

        // Generate URL
        const url = this.servePath
            ? `${this.servePath}/${filePath}`
            : `file://${fullPath}`;

        return {
            path: filePath,
            url,
            size: buffer.length,
            contentType,
        };
    }

    async download(filePath: string): Promise<Uint8Array> {
        const fullPath = this.getFullPath(filePath);

        if (!(await fs().exists(fullPath))) {
            throw new Error(`File not found: ${filePath}`);
        }

        const data = await fs().readFile(fullPath);
        return data;
    }

    async stream(filePath: string): Promise<ReadableStream<Uint8Array>> {
        const fullPath = this.getFullPath(filePath);

        if (!(await fs().exists(fullPath))) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Simulating stream by reading whole file (Limitations of RuntimeAdapter v1)
        const data = await fs().readFile(fullPath);

        return new ReadableStream({
            start(controller) {
                controller.enqueue(data);
                controller.close();
            }
        });
    }

    async getUrl(filePath: string, expiresIn?: number): Promise<string> {
        const fullPath = this.getFullPath(filePath);

        if (!(await fs().exists(fullPath))) {
            throw new Error(`File not found: ${filePath}`);
        }

        // For local storage, we just return the serve path
        if (this.servePath) {
            return `${this.servePath}/${filePath}`;
        }

        return `file://${fullPath}`;
    }

    async delete(filePath: string): Promise<void> {
        const fullPath = this.getFullPath(filePath);

        if (!(await fs().exists(fullPath))) {
            return; // Already deleted
        }

        await fs().remove(fullPath);
        this.logger.debug('File deleted', { path: filePath });
    }

    async exists(filePath: string): Promise<boolean> {
        const fullPath = this.getFullPath(filePath);
        return await fs().exists(fullPath);
    }

    async list(prefix?: string): Promise<FileInfo[]> {
        const searchPath = prefix
            ? this.getFullPath(prefix)
            : this.basePath;

        if (!(await fs().exists(searchPath))) {
            return [];
        }

        const stat = await fs().stat(searchPath);
        if (!stat) return []; // Should catch above, but safety

        // RuntimeAdapter stat doesn't tell us if it's directory explicitly?
        // My implementation in RuntimeAdapter returned { size, mtime }. 
        // readDir works on directories.

        // Try readDir. If it fails, it might be a file.
        // Or check stat size?
        // Actually RuntimeAdapter readDir probably throws if it's a file.

        // This is a gap in RuntimeAdapter (isDirection/isFile on stat).
        // For now, let's assume it's a directory if we are listing it?
        // Or we try readDir.

        try {
            const items = await fs().readDir(searchPath);
            const files: FileInfo[] = [];

            for (const item of items) {
                const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
                const fullItemPath = path().join(searchPath, item.name);
                const itemStat = await fs().stat(fullItemPath);

                files.push({
                    path: itemPath,
                    size: itemStat?.size ?? 0,
                    isDirectory: item.isDirectory,
                    modifiedAt: itemStat?.mtime ?? new Date(),
                });
            }
            return files;
        } catch {
            // Treat as single file if readDir fails?
            return [{
                path: prefix || '',
                size: stat.size,
                isDirectory: false,
                modifiedAt: stat.mtime
            }];
        }
    }

    async getMetadata(filePath: string): Promise<FileMetadata | null> {
        const fullPath = this.getFullPath(filePath);

        if (!(await fs().exists(fullPath))) {
            return null;
        }

        const stat = await fs().stat(fullPath);

        return {
            path: filePath,
            size: stat?.size ?? 0,
            contentType: getMimeType(filePath),
            modifiedAt: stat?.mtime ?? new Date(),
        };
    }

    async copy(source: string, dest: string): Promise<void> {
        // Limitation: Adapter doesn't have copy. Read/Write.
        const sourcePath = this.getFullPath(source);
        const destPath = this.getFullPath(dest);

        if (!(await fs().exists(sourcePath))) {
            throw new Error(`Source file not found: ${source}`);
        }

        const data = await fs().readFile(sourcePath);
        await fs().writeFile(destPath, data);

        this.logger.debug('File copied', { source, dest });
    }

    async move(source: string, dest: string): Promise<void> {
        await this.copy(source, dest);
        await this.delete(source);
        this.logger.debug('File moved', { source, dest });
    }
}

// ============================================================================
// FileSystem Storage Provider
// ============================================================================

export class LocalStorageProvider implements Provider<StorageProviderConfig, StorageAPI> {
    readonly type = 'storage' as const;
    readonly adapter = 'local';
    readonly version = '1.0.0';

    private api: LocalStorageAPI | null = null;

    async init(config: StorageProviderConfig, context: ProviderContext): Promise<StorageAPI> {
        // Determine storage path
        const basePath = config.path
            ? path().join(context.projectDir, config.path)
            : path().join(context.projectDir, 'uploads');

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

        // Ensure base dir exists
        await this.api.init();

        context.log.info('FileSystem storage provider initialized', {
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
}

// ============================================================================
// Register Adapter
// ============================================================================

// Register as 'local'
registerAdapter('storage', 'local', () => new LocalStorageProvider());
