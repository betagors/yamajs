import type { RestEndpointDefinition, NormalizedEndpoint } from './types.js';
export declare class ApiEndpointParser {
    /**
     * Normalize endpoint definition to structured format
     */
    static normalizeEndpoint(endpoint: RestEndpointDefinition, config?: {
        basePath?: string;
    }): NormalizedEndpoint;
    private static applyBasePath;
}
//# sourceMappingURL=parser.d.ts.map