/**
 * @yamajs/cache - Extensible cache abstraction layer for Yama
 * 
 * Provides a unified API for cache operations with:
 * - Multiple adapter support (Redis, Memcached, Memory, etc.)
 * - Hook system for extensibility
 * - Plugin/extension architecture
 * - Namespace support
 * - YAML configuration support
 * 
 * @module @yamajs/cache
 */

import { registerCacheProvider } from './config';
import { createMemoryAdapter } from './memory-adapter';

// Auto-register memory adapter
registerCacheProvider('memory', createMemoryAdapter);

export { Cache } from './cache';

export type {
    CacheConfig,
    CacheExtension,
    HookContext,
    HookHandler,
    HookEvent,
} from './cache';

// Configuration functions for yama.yaml integration
export {
    registerCacheProvider,
    createCacheFromConfig,
    getCacheProvider,
    getRegisteredCacheProviders,
} from './config';

export type { CacheYamlConfig } from './config';

// Built-in adapters
export { MemoryAdapter, createMemoryAdapter } from './memory-adapter';

// Re-export core types for convenience
export type { CacheAdapter } from '@yamajs/kernel';
