import type { StorageAdapter, UploadOptions, UploadResult, StorageMetadata } from '@yamajs/kernel';

/**
 * Storage configuration options
 */
export interface StorageConfig {
    /**
     * Default options to merge with all operations
     */
    defaults?: {
        contentType?: string;
        cacheControl?: string;
        acl?: string;
        [key: string]: unknown;
    };

    /**
     * Public URL base for CDN or public buckets
     * When set, url() will return CDN URLs for public objects
     */
    publicUrl?: string;

    /**
     * Default expiry time in seconds for signed URLs
     */
    defaultExpiry?: number;

    /**
     * Additional provider-specific config
     */
    [key: string]: unknown;
}

/**
 * Extension interface for plugins
 */
export interface StorageExtension {
    /**
     * Extension name
     */
    name?: string;

    /**
     * Setup hook called when extension is registered
     */
    setup?(storage: Storage): void | Promise<void>;

    /**
     * Additional methods that will be available on the Storage instance
     */
    [key: string]: any;
}

/**
 * Hook context passed to event handlers
 */
export interface HookContext {
    key?: string;
    data?: Buffer | ReadableStream<Uint8Array>;
    options?: UploadOptions | { expiresIn?: number; public?: boolean;[key: string]: unknown };
    result?: any;
    [key: string]: unknown;
}

/**
 * Hook handler function type
 */
export type HookHandler = (context: HookContext) => void | Promise<void>;

/**
 * Available hook events
 */
export type HookEvent =
    | 'before:put'
    | 'after:put'
    | 'before:get'
    | 'after:get'
    | 'before:delete'
    | 'after:delete'
    | 'before:url'
    | 'after:url'
    | 'before:stat'
    | 'after:stat'
    | 'before:list'
    | 'after:list';

/**
 * Options for put operation
 */
export interface PutOptions extends UploadOptions {
    /**
     * Mark as public (affects URL generation)
     */
    public?: boolean;
}

/**
 * Options for url operation
 */
export interface UrlOptions {
    /**
     * Expiration time in seconds for signed URLs
     */
    expires?: number;

    /**
     * Whether to generate a public URL
     */
    public?: boolean;

    /**
     * Additional provider-specific options
     */
    [key: string]: unknown;
}

/**
 * Storage - Unified, extensible storage abstraction layer
 * 
 * This class provides a stable API for storage operations while
 * allowing future enhancements through hooks and extensions without
 * breaking changes.
 * 
 * @example
 * ```js
 * // Basic usage
 * const storage = new Storage(s3Adapter);
 * await storage.put('file.jpg', buffer);
 * const url = await storage.url('file.jpg');
 * 
 * // With hooks
 * storage.on('after:put', async ({ key, result }) => {
 *   console.log(`Uploaded ${key}`);
 * });
 * 
 * // With extensions
 * storage.use(cdnPlugin);
 * await storage.purgeCache('file.jpg'); // Method from plugin
 * ```
 */
export class Storage {
    /**
     * The underlying storage adapter
     */
    readonly adapter: StorageAdapter;

    /**
     * Storage configuration
     */
    readonly config: StorageConfig;

    /**
     * Event hooks registry
     * @private
     */
    private readonly hooks: Map<HookEvent, HookHandler[]>;

    /**
     * Registered extensions
     * @private
     */
    private readonly extensions: StorageExtension[];

    /**
     * Create a new Storage instance
     * 
     * @param adapter - Storage adapter (e.g., S3, local filesystem)
     * @param config - Optional configuration
     */
    constructor(adapter: StorageAdapter, config: StorageConfig = {}) {
        this.adapter = adapter;
        this.config = config;
        this.hooks = new Map();
        this.extensions = [];

        // Return a Proxy to enable dynamic extension methods
        return new Proxy(this, {
            get(target, prop: string | symbol) {
                // Check if property exists on Storage instance
                if (prop in target) {
                    return (target as any)[prop];
                }

                // Check extensions for additional methods
                for (const ext of target.extensions) {
                    if (typeof prop === 'string' && prop in ext && typeof ext[prop] === 'function') {
                        return ext[prop].bind(ext);
                    }
                }

                return undefined;
            },
        });
    }

    /**
     * Upload/put data to storage
     * 
     * @param key - Storage key/path
     * @param data - Data to upload (Buffer or ReadableStream)
     * @param options - Upload options
     * @returns Upload result with key, size, etag, etc.
     */
    async put(
        key: string,
        data: Buffer | ReadableStream<Uint8Array>,
        options: PutOptions = {}
    ): Promise<UploadResult> {
        // Merge with default options
        const finalOptions = { ...this.config.defaults, ...options };

        // Run before hooks
        await this.runHooks('before:put', { key, data, options: finalOptions });

        // Perform upload
        const result = await this.adapter.upload(key, data, finalOptions);

        // Run after hooks
        await this.runHooks('after:put', { key, result, options: finalOptions });

        return result;
    }

    /**
     * Download/get data from storage
     * 
     * @param key - Storage key/path
     * @returns Downloaded data as Buffer or ReadableStream
     */
    async get(key: string): Promise<Buffer | ReadableStream<Uint8Array>> {
        // Run before hooks
        await this.runHooks('before:get', { key });

        // Perform download
        const result = await this.adapter.download(key);

        // Run after hooks
        await this.runHooks('after:get', { key, result });

        return result;
    }

    /**
     * Get a URL for accessing the stored object
     * 
     * This method is smart about URL generation:
     * - If object is public and publicUrl is configured, returns CDN URL
     * - Otherwise, generates a signed/presigned URL
     * 
     * @param key - Storage key/path
     * @param options - URL generation options
     * @returns URL string
     */
    async url(key: string, options: UrlOptions = {}): Promise<string> {
        // Merge with defaults
        const finalOptions = {
            expires: options.expires ?? this.config.defaultExpiry,
            public: options.public,
            ...options,
        };

        // Run before hooks
        await this.runHooks('before:url', { key, options: finalOptions });

        // Smart URL generation
        let result: string;

        // If public and we have a CDN URL configured, use it
        if (finalOptions.public && this.config.publicUrl && !finalOptions.expires) {
            result = `${this.config.publicUrl}/${key}`;
        } else {
            // Otherwise use adapter's URL generation (presigned)
            const expiresIn = finalOptions.expires;
            result = await this.adapter.getUrl(key, expiresIn);
        }

        // Run after hooks
        await this.runHooks('after:url', { key, result, options: finalOptions });

        return result;
    }

    /**
     * Delete an object from storage
     * 
     * @param key - Storage key/path
     */
    async delete(key: string): Promise<void> {
        // Run before hooks
        await this.runHooks('before:delete', { key });

        // Perform delete
        await this.adapter.delete(key);

        // Run after hooks
        await this.runHooks('after:delete', { key });
    }

    /**
     * Get metadata/stats for a stored object
     * 
     * @param key - Storage key/path
     * @returns Metadata object or null if not found
     */
    async stat(key: string): Promise<StorageMetadata | null> {
        // Run before hooks
        await this.runHooks('before:stat', { key });

        // Get metadata
        const result = await this.adapter.getMetadata(key);

        // Run after hooks
        await this.runHooks('after:stat', { key, result });

        return result;
    }

    /**
     * List objects with optional prefix filter
     * 
     * @param options - List options (prefix, etc.)
     * @returns Async iterator of object keys
     */
    async *list(options: { prefix?: string;[key: string]: unknown } = {}): AsyncGenerator<string> {
        // Run before hooks
        await this.runHooks('before:list', { options });

        // Get list from adapter
        const keys = await this.adapter.list(options.prefix);

        // Yield each key
        for (const key of keys) {
            yield key;
        }

        // Run after hooks
        await this.runHooks('after:list', { options, result: keys });
    }

    /**
     * Check if an object exists
     * 
     * @param key - Storage key/path
     * @returns true if exists, false otherwise
     */
    async exists(key: string): Promise<boolean> {
        return this.adapter.exists(key);
    }

    /**
     * Copy an object to a new key
     * 
     * @param sourceKey - Source key/path
     * @param destKey - Destination key/path
     */
    async copy(sourceKey: string, destKey: string): Promise<void> {
        return this.adapter.copy(sourceKey, destKey);
    }

    // ============================================================
    // Extension API (non-breaking additions for future features)
    // ============================================================

    /**
     * Register an event hook
     * 
     * Hooks allow you to add behavior before/after storage operations
     * without modifying the core API.
     * 
     * @param event - Hook event name
     * @param handler - Handler function
     * @returns this for chaining
     * 
     * @example
     * ```js
     * storage.on('after:put', async ({ key, result }) => {
     *   console.log(`Uploaded ${key}, size: ${result.size}`);
     * });
     * ```
     */
    on(event: HookEvent, handler: HookHandler): this {
        if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
        }
        this.hooks.get(event)!.push(handler);
        return this;
    }

    /**
     * Register a storage extension/plugin
     * 
     * Extensions can add new methods and behavior to Storage without
     * breaking the core API.
     * 
     * @param extension - Extension object
     * @returns this for chaining
     * 
     * @example
     * ```js
     * const cdnExtension = {
     *   async purgeCache(key) {
     *     await fetch(`https://cdn.example.com/purge/${key}`, { method: 'POST' });
     *   },
     *   setup(storage) {
     *     storage.on('after:put', ({ key }) => this.purgeCache(key));
     *   }
     * };
     * 
     * storage.use(cdnExtension);
     * await storage.purgeCache('file.jpg'); // Method from extension!
     * ```
     */
    use(extension: StorageExtension): this {
        this.extensions.push(extension);

        // Call setup hook if provided
        if (extension.setup) {
            extension.setup(this);
        }

        return this;
    }

    /**
     * Run all registered hooks for an event
     * 
     * @private
     * @param event - Event name
     * @param context - Context object passed to handlers
     */
    private async runHooks(event: HookEvent, context: HookContext): Promise<void> {
        const handlers = this.hooks.get(event) || [];

        for (const handler of handlers) {
            await handler(context);
        }
    }
}
