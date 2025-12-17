import type { PolicyDefinition, ResolvedPolicy, YamaPolicies } from "./types.js";
/**
 * Default public policy (no restrictions)
 */
export declare const DEFAULT_PUBLIC_POLICY: ResolvedPolicy;
/**
 * Resolve policy by name
 */
export declare function resolvePolicy(policyName: string | undefined, policies: YamaPolicies | undefined): ResolvedPolicy;
/**
 * Normalize policy definition to resolved policy
 */
export declare function normalizePolicy(policy: PolicyDefinition): ResolvedPolicy;
/**
 * Merge two policies (second overrides first)
 */
export declare function mergePolicies(base: ResolvedPolicy, override: ResolvedPolicy): ResolvedPolicy;
//# sourceMappingURL=resolver.d.ts.map