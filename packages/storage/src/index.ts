/**
 * @yamajs/storage - Extensible storage abstraction layer for Yama
 * 
 * Provides a unified API for storage operations with:
 * - Multiple adapter support (S3, local filesystem, etc.)
 * - Hook system for extensibility
 * - Plugin/extension architecture
 * - Smart CDN URL generation
 * - Non-breaking API evolution
 * 
 * @module @yamajs/storage
 */

export { Storage } from './storage';

export type {
    StorageConfig,
    StorageExtension,
    HookContext,
    HookHandler,
    HookEvent,
    PutOptions,
    UrlOptions,
} from './storage';

// Configuration functions for yama.yaml integration
export {
    registerStorageProvider,
    createStorageFromConfig,
    getStorageProvider,
    getRegisteredStorageProviders,
} from './config';

export type { StorageYamlConfig } from './config';

// Re-export core types for convenience
export type {
    StorageAdapter,
    StorageBucket,
    UploadOptions,
    UploadResult,
    StorageMetadata,
} from '@yamajs/kernel';
