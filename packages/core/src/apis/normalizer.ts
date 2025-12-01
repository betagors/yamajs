import type { ApisConfig, NormalizedApisConfig, NormalizedRestConfig, RestApiConfig, RestApisConfig } from './types.js';
import { ApiEndpointParser } from './parser.js';

export function normalizeApisConfig(config: { apis?: ApisConfig }): NormalizedApisConfig {
  const result: NormalizedApisConfig = {
    rest: [],
  };

  if (!config.apis?.rest) {
    return result;
  }

  const restConfig = config.apis.rest;

  // Check if it's a single config (has endpoints array) or multiple named configs
  // A single config has an 'endpoints' property that is an array
  // Multiple named configs is an object where each value is a RestApiConfig
  const hasEndpointsArray = restConfig && typeof restConfig === 'object' && 'endpoints' in restConfig && Array.isArray((restConfig as RestApiConfig).endpoints);
  
  if (hasEndpointsArray) {
    // Single REST config
    const singleConfig = restConfig as RestApiConfig;
    // Skip if disabled
    if (singleConfig.enabled !== false) {
      result.rest.push(normalizeRestConfig('default', singleConfig));
    }
  } else {
    // Multiple named REST configs (object with string keys)
    const namedConfigs = restConfig as RestApisConfig;
    const configNames = Object.keys(namedConfigs);
    console.log(`[normalizeApisConfig] Found ${configNames.length} named REST config(s): ${configNames.join(', ')}`);
    
    for (const [name, restConfigEntry] of Object.entries(namedConfigs)) {
      // Skip disabled configs
      if (restConfigEntry && restConfigEntry.enabled === false) {
        console.log(`[normalizeApisConfig] Skipping disabled config: ${name}`);
        continue;
      }
      if (restConfigEntry) {
        const endpointCount = restConfigEntry.endpoints?.length || 0;
        console.log(`[normalizeApisConfig] Processing config "${name}" with ${endpointCount} endpoint(s)`);
        result.rest.push(normalizeRestConfig(name, restConfigEntry));
      }
    }
  }

  console.log(`[normalizeApisConfig] Returning ${result.rest.length} normalized REST config(s) with ${result.rest.reduce((sum, cfg) => sum + (cfg.endpoints?.length || 0), 0)} total endpoint(s)`);
  return result;
}

function normalizeRestConfig(
  name: string,
  config: RestApiConfig
): NormalizedRestConfig {
  const rawEndpoints = config.endpoints || [];
  console.log(`[normalizeRestConfig] Config "${name}": Processing ${rawEndpoints.length} raw endpoint(s)`);
  
  const endpoints = rawEndpoints.map((endpoint, index) => {
    try {
      const normalized = ApiEndpointParser.normalizeEndpoint(endpoint, {
        basePath: config.basePath,
      });
      console.log(`[normalizeRestConfig] Endpoint ${index + 1}: ${normalized.method} ${normalized.path}`);
      return normalized;
    } catch (error) {
      console.error(`[normalizeRestConfig] Error normalizing endpoint ${index + 1}:`, error);
      throw error;
    }
  });

  console.log(`[normalizeRestConfig] Config "${name}": Successfully normalized ${endpoints.length} endpoint(s)`);
  return {
    name,
    basePath: config.basePath,
    enabled: config.enabled,
    endpoints,
  };
}
