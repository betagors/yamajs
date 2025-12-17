/**
 * Policy definition
 */
export interface PolicyDefinition {
    /**
     * Authentication configuration
     */
    auth?: boolean | {
        required?: boolean;
        roles?: string[];
        permissions?: string[];
        check?: string;
    };
}
/**
 * Collection of policies
 */
export interface YamaPolicies {
    [policyName: string]: PolicyDefinition;
}
/**
 * Resolved policy (normalized)
 */
export interface ResolvedPolicy {
    auth: {
        required: boolean;
        roles?: string[];
        permissions?: string[];
        check?: string;
    };
}
//# sourceMappingURL=types.d.ts.map