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
} from '../types.js';

// Re-export adapter utilities
export {
    LocalStorageProvider,
    LocalStorageAPI,
    parseFileSize,
    matchesMimeType,
    getMimeType,
} from './adapters/local.js';

// Register adapters (side effect)
import './adapters/local.js';
