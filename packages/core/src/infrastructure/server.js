/**
 * Registry of HTTP server adapters by engine
 */
const serverAdapters = new Map();
/**
 * Register an HTTP server adapter for a specific engine
 */
export function registerHttpServerAdapter(engine, factory) {
    serverAdapters.set(engine.toLowerCase(), factory);
}
/**
 * Create an HTTP server adapter for the given engine
 */
export function createHttpServerAdapter(engine = "fastify", options) {
    const normalizedEngine = engine.toLowerCase();
    const factory = serverAdapters.get(normalizedEngine);
    if (!factory) {
        throw new Error(`Unsupported HTTP server engine: ${engine}. Supported engines: ${Array.from(serverAdapters.keys()).join(", ")}`);
    }
    return factory(options);
}
//# sourceMappingURL=server.js.map