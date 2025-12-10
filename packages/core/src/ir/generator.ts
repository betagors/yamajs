import { normalizeApisConfig, type NormalizedEndpoint } from "../apis/normalizer.js";
import { getSchemasFromConfig } from "../config-normalizer.js";
import type { YamaConfig } from "../types.js";
import type { YamaIR, IRHttpEndpoint } from "./types.js";

const IR_VERSION = "0.1.0";

function joinPath(basePath: string | undefined, path: string): string {
  const base = (basePath || "").replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const full = `${base}${suffix}`;
  return full || "/";
}

/**
 * Build a minimal, versioned IR from a YamaConfig.
 * The IR intentionally excludes secrets and focuses on public shapes.
 */
export function generateIR(config: YamaConfig): YamaIR {
  const schemas = getSchemasFromConfig(config) || {};

  const normalizedApis = normalizeApisConfig({
    apis: config.apis,
    operations: (config as any).operations,
    policies: (config as any).policies,
    schemas: (config as any).schemas || (config as any).entities,
  });

  const endpoints: IRHttpEndpoint[] = [];

  // Prefer normalized REST configs
  if (normalizedApis?.rest?.length) {
    for (const restConfig of normalizedApis.rest) {
      if (!restConfig.endpoints?.length) continue;
      for (const endpoint of restConfig.endpoints) {
        endpoints.push(normalizeEndpointForIr(endpoint, restConfig.name, restConfig.basePath));
      }
    }
  } else if (Array.isArray((config as any).endpoints)) {
    // Fallback to legacy flat endpoints
    for (const endpoint of (config as any).endpoints as NormalizedEndpoint[]) {
      endpoints.push(normalizeEndpointForIr(endpoint, "default", (config as any).apis?.rest?.basePath));
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

function normalizeEndpointForIr(
  endpoint: NormalizedEndpoint,
  apiName?: string,
  basePath?: string
): IRHttpEndpoint {
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

