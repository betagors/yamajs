/**
 * Upload options for storage operations
 */
export interface UploadOptions {
  contentType?: string;
  contentEncoding?: string;
  metadata?: Record<string, string>;
  acl?: string;
  cacheControl?: string;
  expires?: Date;
  [key: string]: unknown; // Allow provider-specific options
}

/**
 * Result of an upload operation
 */
export interface UploadResult {
  key: string;
  url?: string;
  size?: number;
  etag?: string;
  versionId?: string;
  [key: string]: unknown; // Allow provider-specific fields
}

/**
 * Storage metadata for a file
 */
export interface StorageMetadata {
  key: string;
  size: number;
  contentType?: string;
  contentEncoding?: string;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
  [key: string]: unknown; // Allow provider-specific fields
}

/**
 * Storage adapter interface - unified API for all storage providers
 */
export interface StorageAdapter {
  /**
   * Upload data to storage
   * @param key - Object key/path
   * @param data - Data to upload (Buffer or ReadableStream)
   * @param options - Upload options
   */
  upload(
    key: string,
    data: Buffer | ReadableStream<Uint8Array>,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Download data from storage
   * @param key - Object key/path
   * @returns Buffer or ReadableStream
   */
  download(key: string): Promise<Buffer | ReadableStream<Uint8Array>>;

  /**
   * Delete an object from storage
   * @param key - Object key/path
   */
  delete(key: string): Promise<void>;

  /**
   * Check if an object exists
   * @param key - Object key/path
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a URL for an object (signed URL for private objects)
   * @param key - Object key/path
   * @param expiresIn - Expiration time in seconds (for signed URLs)
   */
  getUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * List objects with optional prefix
   * @param prefix - Key prefix to filter by
   */
  list(prefix?: string): Promise<string[]>;

  /**
   * Get metadata for an object
   * @param key - Object key/path
   */
  getMetadata(key: string): Promise<StorageMetadata | null>;

  /**
   * Copy an object to a new key
   * @param sourceKey - Source object key
   * @param destKey - Destination object key
   */
  copy(sourceKey: string, destKey: string): Promise<void>;
}

/**
 * Storage bucket - wrapper around adapter with bucket context
 */
export interface StorageBucket {
  /**
   * Upload data to this bucket
   */
  upload(
    key: string,
    data: Buffer | ReadableStream<Uint8Array>,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Download data from this bucket
   */
  download(key: string): Promise<Buffer | ReadableStream<Uint8Array>>;

  /**
   * Delete an object from this bucket
   */
  delete(key: string): Promise<void>;

  /**
   * Check if an object exists in this bucket
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a URL for an object in this bucket
   */
  getUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * List objects in this bucket
   */
  list(prefix?: string): Promise<string[]>;

  /**
   * Get metadata for an object in this bucket
   */
  getMetadata(key: string): Promise<StorageMetadata | null>;

  /**
   * Copy an object within this bucket
   */
  copy(sourceKey: string, destKey: string): Promise<void>;
}

/**
 * Storage configuration for plugins
 */
export interface StorageConfig {
  [key: string]: unknown;
}

/**
 * Storage adapter factory function type
 */
export type StorageAdapterFactory = (config: StorageConfig) => StorageAdapter;

/**
 * Registry of storage adapters by provider
 */
const storageAdapters = new Map<string, StorageAdapterFactory>();

/**
 * Register a storage adapter for a specific provider
 */
export function registerStorageAdapter(
  provider: string,
  factory: StorageAdapterFactory
): void {
  storageAdapters.set(provider.toLowerCase(), factory);
}

/**
 * Create a storage adapter for the given provider
 */
export function createStorageAdapter(
  provider: string,
  config: StorageConfig
): StorageAdapter {
  const normalizedProvider = provider.toLowerCase();
  const factory = storageAdapters.get(normalizedProvider);

  if (!factory) {
    throw new Error(
      `Unsupported storage provider: ${provider}. Supported providers: ${Array.from(storageAdapters.keys()).join(", ")}`
    );
  }

  return factory(config);
}

