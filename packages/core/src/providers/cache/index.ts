/**
 * Cache Provider
 * 
 * Provides caching with multiple backend support.
 */

// Re-export types
export type { CacheProviderConfig, CacheAPI } from '../types.js';

// Re-export adapter utilities
export {
    MemoryCacheProvider,
    MemoryCache,
    parseTTL,
} from './adapters/memory.js';

// Register adapters (side effect)
import './adapters/memory.js';
