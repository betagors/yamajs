// Base API configuration
export interface ApiConfig {
    enabled?: boolean;
    basePath?: string;
  }
  
// REST API endpoint definition (explicit structure only)
export interface RestEndpointDefinition {
  method: string;
  path: string;
  response?: string | { type: string };
  handler?: string | object;
  body?: string | { type: string } | { fields?: Record<string, any> };
  query?: Record<string, any>;
  params?: Record<string, any>;
  auth?: any;
  rateLimit?: any;
  description?: string;
}
  
  // REST API configuration
  export interface RestApiConfig extends ApiConfig {
    endpoints?: RestEndpointDefinition[];
    defaultPolicy?: string;
    operations?: Array<string | { operation: string; policy?: string; path?: string }>;
    exclude?: string[];
    include?: "all" | string[];
    paths?: Record<string, string>;
  }
  
  // Multiple named REST configs
  export interface RestApisConfig {
    [name: string]: RestApiConfig;
  }
  
  // Main APIs configuration
  export interface ApisConfig {
    rest?: RestApiConfig | RestApisConfig;  // Single config or multiple named configs
    graphql?: any;  // Future: GraphQL config
    mcp?: any;      // Future: MCP config
    protobuf?: any; // Future: Protobuf config
  }
  
  // Normalized internal format
  export interface NormalizedEndpoint {
    method: string;
    path: string;
    response?: { type: string } | { properties?: Record<string, any> };
    handler?: string | object;
    body?: string | { type: string } | { fields?: Record<string, any> };
    query?: Record<string, any>;
    params?: Record<string, any>;
    auth?: any;
    rateLimit?: any;
    description?: string;
  }
  
  export interface NormalizedRestConfig {
    name: string;
    basePath?: string;
    enabled?: boolean;
    endpoints: NormalizedEndpoint[];
  }
  
  export interface NormalizedApisConfig {
    rest: NormalizedRestConfig[];
  }
  