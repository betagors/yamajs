import { Storage } from './storage';
import type { StorageAdapter } from '@yamajs/core';

/**
 * Storage configuration from yama.yaml
 */
export interface StorageYamlConfig {
    /**
     * Storage provider (e.g., 's3', 'local', 'gcs', 'azure')
     */
    provider: string;

    /**
     * Bucket or container name
     */
    bucket?: string;

    /**
     * Public CDN URL base
     */
    publicUrl?: string;

    /**
     * Default expiry for signed URLs (in seconds)
     */
    defaultExpiry?: number;

    /**
     * Default options for all operations
     */
    defaults?: {
        contentType?: string;
        cacheControl?: string;
        acl?: string;
        [key: string]: unknown;
    };

    /**
     * Provider-specific options
     */
    options?: Record<string, unknown>;

    /**
     * Additional arbitrary config
     */
    [key: string]: unknown;
}

/**
 * Storage adapter registry
 */
const storageAdapters = new Map<string, (config: any) => StorageAdapter>();

/**
 * Register a storage adapter factory
 *
 * @param provider - Provider name (e.g., 's3', 'local')
 * @param factory - Factory function that creates the adapter
 *
 * @example
 * ```ts
 * import { registerStorageProvider } from '@yamajs/storage';
 * import { createS3Adapter } from '@yamajs/s3';
 *
 * registerStorageProvider('s3', createS3Adapter);
 * ```
 */
export function registerStorageProvider(
    provider: string,
    factory: (config: any) => StorageAdapter
): void {
    storageAdapters.set(provider.toLowerCase(), factory);
}

/**
 * Create storage from YAML configuration
 *
 * This function reads the storage configuration from yama.yaml and
 * creates a Storage instance with the appropriate adapter.
 *
 * @param config - Storage configuration from yama.yaml
 * @returns Storage instance
 * @throws Error if provider is not registered
 *
 * @example
 * ```yaml
 * # yama.yaml
 * storage:
 *   provider: s3
 *   bucket: my-app-uploads
 *   publicUrl: https://cdn.myapp.com
 *   defaultExpiry: 3600
 *   defaults:
 *     cacheControl: max-age=31536000
 *   options:
 *     region: us-east-1
 *     credentials:
 *       accessKeyId: ${AWS_ACCESS_KEY_ID}
 *       secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
 * ```
 *
 * ```ts
 * import { createStorageFromConfig } from '@yamajs/storage';
 *
 * const storage = createStorageFromConfig(yamaConfig.storage);
 * await storage.put('file.jpg', buffer);
 * ```
 */
export function createStorageFromConfig(config: StorageYamlConfig): Storage {
    const provider = config.provider.toLowerCase();
    const factory = storageAdapters.get(provider);

    if (!factory) {
        const available = Array.from(storageAdapters.keys());
        throw new Error(
            `Unknown storage provider: ${config.provider}. ` +
            `Available providers: ${available.join(', ')}. ` +
            `Make sure you've registered the adapter with registerStorageProvider().`
        );
    }

    // Create the adapter with provider-specific options
    const adapterConfig = {
        bucket: config.bucket,
        ...config.options,
    };

    const adapter = factory(adapterConfig);

    // Create Storage instance with config
    const storage = new Storage(adapter, {
        publicUrl: config.publicUrl,
        defaultExpiry: config.defaultExpiry,
        defaults: config.defaults,
    });

    return storage;
}

/**
 * Get storage adapter factory for a provider
 *
 * @param provider - Provider name
 * @returns Adapter factory or undefined
 */
export function getStorageProvider(
    provider: string
): ((config: any) => StorageAdapter) | undefined {
    return storageAdapters.get(provider.toLowerCase());
}

/**
 * Get list of registered storage providers
 *
 * @returns Array of provider names
 */
export function getRegisteredStorageProviders(): string[] {
    return Array.from(storageAdapters.keys());
}
