/**
 * Storage Provider
 * 
 * Provides file storage with swappable adapters.
 */

// Re-export types
export type {
    StorageProviderConfig,
    StorageAPI,
    UploadOptions,
    UploadResult,
    FileInfo,
    FileMetadata,
} from './types.js';

// Adapters are now in separate packages (e.g. @yamajs/storage-local)
