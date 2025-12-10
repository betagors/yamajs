import type { ApisConfig, NormalizedApisConfig, NormalizedRestConfig, RestApiConfig, RestApisConfig } from './types.js';
import { ApiEndpointParser } from './parser.js';
import { parseOperations, generateEndpointsFromOperations } from '../operations/index.js';
import { resolvePolicy } from '../policies/index.js';
import type { YamaEntities } from '../entities.js';
import type { YamaOperations } from '../operations/types.js';
import type { YamaPolicies } from '../policies/types.js';

export function normalizeApisConfig(
  config: { 
    apis?: ApisConfig;
    operations?: YamaOperations;
    policies?: YamaPolicies;
    schemas?: YamaEntities;
  }
): NormalizedApisConfig {
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
      result.rest.push(normalizeRestConfig(
        'default', 
        singleConfig,
        config.operations,
        config.policies,
        config.schemas
      ));
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
        const operationCount = restConfigEntry.operations?.length || 0;
        console.log(`[normalizeApisConfig] Processing config "${name}" with ${endpointCount} endpoint(s) and ${operationCount} operation(s)`);
        result.rest.push(normalizeRestConfig(
          name, 
          restConfigEntry,
          config.operations,
          config.policies,
          config.schemas
        ));
      }
    }
  }

  console.log(`[normalizeApisConfig] Returning ${result.rest.length} normalized REST config(s) with ${result.rest.reduce((sum, cfg) => sum + (cfg.endpoints?.length || 0), 0)} total endpoint(s)`);
  return result;
}

function normalizeRestConfig(
  name: string,
  config: RestApiConfig,
  operations?: YamaOperations,
  policies?: YamaPolicies,
  allEntities?: YamaEntities
): NormalizedRestConfig {
  const endpoints: any[] = [];
  
  // Process operations if defined
  if (operations && config.operations) {
    const availableEntities = allEntities ? new Set(Object.keys(allEntities)) : undefined;
    const parsedOps = parseOperations(operations, availableEntities);
    
    // Determine which operations to include
    let opsToInclude = parsedOps;
    if (config.include === "all") {
      // Include all operations
      opsToInclude = parsedOps;
    } else if (Array.isArray(config.include)) {
      // Include only specified operations
      opsToInclude = parsedOps.filter(op => config.include!.includes(op.name));
    } else if (Array.isArray(config.exclude)) {
      // Exclude specified operations
      opsToInclude = parsedOps.filter(op => !config.exclude!.includes(op.name));
    } else if (Array.isArray(config.operations)) {
      // Include only operations listed in config.operations
      const opNames = new Set(
        config.operations.map(op => 
          typeof op === "string" ? op : op.operation
        )
      );
      opsToInclude = parsedOps.filter(op => opNames.has(op.name));
    }
    
    // Generate endpoints from operations
    const operationEndpoints = generateEndpointsFromOperations(opsToInclude, config.basePath);
    
    // Apply policies to endpoints
    const defaultPolicy = resolvePolicy(config.defaultPolicy, policies);
    
    // Create a map of operation names to their configs
    const opConfigMap = new Map<string, { policy?: string; path?: string }>();
    if (Array.isArray(config.operations)) {
      for (const op of config.operations) {
        if (typeof op === "string") {
          opConfigMap.set(op, {});
        } else {
          opConfigMap.set(op.operation, { policy: op.policy, path: op.path });
        }
      }
    }
    
    for (const endpoint of operationEndpoints) {
      // Get operation name from endpoint metadata or match by description
      const operationName = (endpoint as any)._operationName;
      if (!operationName) {
        // Fallback: try to extract from description or skip
        endpoints.push(endpoint);
        continue;
      }
      
      // Get operation config
      const opConfig = opConfigMap.get(operationName) || {};
      
      // Determine policy
      const policyName = opConfig.policy || config.defaultPolicy || "public";
      const policy = resolvePolicy(policyName, policies);
      
      // Apply policy to endpoint
      endpoint.auth = {
        required: policy.auth.required,
        roles: policy.auth.roles,
        permissions: policy.auth.permissions,
        handler: policy.auth.check,
      };
      
      // Apply custom path if specified
      if (opConfig.path) {
        endpoint.path = config.basePath 
          ? `${config.basePath}${opConfig.path}`
          : opConfig.path;
      } else if (config.paths && typeof config.paths === "object" && config.paths[operationName]) {
        // Apply path override from paths object
        endpoint.path = config.basePath
          ? `${config.basePath}${config.paths[operationName]}`
          : config.paths[operationName];
      }
      
      endpoints.push(endpoint);
    }
  }
  
  // Process legacy endpoints if defined
  const rawEndpoints = config.endpoints || [];
  console.log(`[normalizeRestConfig] Config "${name}": Processing ${rawEndpoints.length} raw endpoint(s)`);
  
  const legacyEndpoints = rawEndpoints.map((endpoint, index) => {
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
  
  // Merge operation endpoints with legacy endpoints
  endpoints.push(...legacyEndpoints);

  console.log(`[normalizeRestConfig] Config "${name}": Successfully normalized ${endpoints.length} endpoint(s)`);
  return {
    name,
    basePath: config.basePath,
    enabled: config.enabled,
    endpoints,
  };
}
