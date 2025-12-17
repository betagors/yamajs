import { normalizeApisConfig } from "../apis/normalizer.js";
import { getSchemasFromConfig } from "../config-normalizer.js";
const IR_VERSION = "0.1.0";
function joinPath(basePath, path) {
    const base = (basePath || "").replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    const full = `${base}${suffix}`;
    return full || "/";
}
/**
 * Build a minimal, versioned IR from a YamaConfig.
 * The IR intentionally excludes secrets and focuses on public shapes.
 */
export function generateIR(config) {
    const schemas = getSchemasFromConfig(config) || {};
    const normalizedApis = normalizeApisConfig({
        apis: config.apis,
        operations: config.operations,
        policies: config.policies,
        schemas: config.schemas || config.entities,
    });
    const endpoints = [];
    // Prefer normalized REST configs
    if (normalizedApis?.rest?.length) {
        for (const restConfig of normalizedApis.rest) {
            if (!restConfig.endpoints?.length)
                continue;
            for (const endpoint of restConfig.endpoints) {
                endpoints.push(normalizeEndpointForIr(endpoint, restConfig.name, restConfig.basePath));
            }
        }
    }
    else if (Array.isArray(config.endpoints)) {
        // Fallback to legacy flat endpoints
        for (const endpoint of config.endpoints) {
            endpoints.push(normalizeEndpointForIr(endpoint, "default", config.apis?.rest?.basePath));
        }
    }
    return {
        irVersion: IR_VERSION,
        name: config.name,
        version: config.version,
        baseUrl: config.server?.baseUrl,
        auth: config.auth ? { providers: config.auth.providers } : undefined,
        schemas,
        endpoints,
        apis: normalizedApis,
    };
}
function normalizeEndpointForIr(endpoint, apiName, basePath) {
    return {
        method: endpoint.method,
        path: joinPath(basePath, endpoint.path),
        description: endpoint.description,
        query: endpoint.query,
        params: endpoint.params,
        body: endpoint.body,
        response: endpoint.response,
        auth: endpoint.auth,
        rateLimit: endpoint.rateLimit,
        apiName,
        basePath,
    };
}
//# sourceMappingURL=generator.js.map