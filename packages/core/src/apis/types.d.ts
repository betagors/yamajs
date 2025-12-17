export interface ApiConfig {
    enabled?: boolean;
    basePath?: string;
}
export interface RestEndpointDefinition {
    method: string;
    path: string;
    response?: string | {
        type: string;
    };
    handler?: string | object;
    body?: string | {
        type: string;
    } | {
        fields?: Record<string, any>;
    };
    query?: Record<string, any>;
    params?: Record<string, any>;
    auth?: any;
    rateLimit?: any;
    description?: string;
}
export interface RestApiConfig extends ApiConfig {
    endpoints?: RestEndpointDefinition[];
    defaultPolicy?: string;
    operations?: Array<string | {
        operation: string;
        policy?: string;
        path?: string;
    }>;
    exclude?: string[];
    include?: "all" | string[];
    paths?: Record<string, string>;
}
export interface RestApisConfig {
    [name: string]: RestApiConfig;
}
export interface ApisConfig {
    rest?: RestApiConfig | RestApisConfig;
    graphql?: any;
    mcp?: any;
    protobuf?: any;
}
export interface NormalizedEndpoint {
    method: string;
    path: string;
    response?: {
        type: string;
    } | {
        properties?: Record<string, any>;
    };
    handler?: string | object;
    body?: string | {
        type: string;
    } | {
        fields?: Record<string, any>;
    };
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
//# sourceMappingURL=types.d.ts.map