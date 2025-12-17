export class ApiEndpointParser {
    /**
     * Normalize endpoint definition to structured format
     */
    static normalizeEndpoint(endpoint, config) {
        // Normalize body - preserve fields if present
        let normalizedBody = undefined;
        if (endpoint.body) {
            if (typeof endpoint.body === 'string') {
                normalizedBody = { type: endpoint.body };
            }
            else if (typeof endpoint.body === 'object') {
                // Preserve the body object as-is (could have type or fields)
                normalizedBody = endpoint.body;
            }
        }
        return {
            method: endpoint.method,
            path: this.applyBasePath(endpoint.path, config?.basePath),
            response: typeof endpoint.response === 'string'
                ? { type: endpoint.response }
                : endpoint.response,
            handler: endpoint.handler,
            body: normalizedBody,
            query: endpoint.query,
            params: endpoint.params,
            auth: endpoint.auth,
            rateLimit: endpoint.rateLimit,
            description: endpoint.description,
        };
    }
    static applyBasePath(path, basePath) {
        if (!basePath)
            return path;
        // Ensure basePath ends with / and path doesn't start with /
        const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${normalizedBase}${normalizedPath}`;
    }
}
//# sourceMappingURL=parser.js.map