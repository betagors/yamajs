/**
 * Registry of storage adapters by provider
 */
const storageAdapters = new Map();
/**
 * Register a storage adapter for a specific provider
 */
export function registerStorageAdapter(provider, factory) {
    storageAdapters.set(provider.toLowerCase(), factory);
}
/**
 * Create a storage adapter for the given provider
 */
export function createStorageAdapter(provider, config) {
    const normalizedProvider = provider.toLowerCase();
    const factory = storageAdapters.get(normalizedProvider);
    if (!factory) {
        throw new Error(`Unsupported storage provider: ${provider}. Supported providers: ${Array.from(storageAdapters.keys()).join(", ")}`);
    }
    return factory(config);
}
//# sourceMappingURL=storage.js.map