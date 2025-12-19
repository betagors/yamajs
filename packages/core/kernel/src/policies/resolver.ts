import type { PolicyDefinition, ResolvedPolicy, YamaPolicies } from "./types.js";

/**
 * Default public policy (no restrictions)
 */
export const DEFAULT_PUBLIC_POLICY: ResolvedPolicy = {
  auth: {
    required: false,
  },
};

/**
 * Resolve policy by name
 */
export function resolvePolicy(
  policyName: string | undefined,
  policies: YamaPolicies | undefined
): ResolvedPolicy {
  // If no policy name, return public
  if (!policyName) {
    return DEFAULT_PUBLIC_POLICY;
  }
  
  // If no policies defined, return public
  if (!policies || typeof policies !== "object") {
    return DEFAULT_PUBLIC_POLICY;
  }
  
  // Look up policy
  const policy = policies[policyName];
  if (!policy) {
    // Policy not found - return public as fallback
    return DEFAULT_PUBLIC_POLICY;
  }
  
  // Normalize policy
  return normalizePolicy(policy);
}

/**
 * Normalize policy definition to resolved policy
 */
export function normalizePolicy(policy: PolicyDefinition): ResolvedPolicy {
  if (!policy.auth) {
    return DEFAULT_PUBLIC_POLICY;
  }
  
  if (typeof policy.auth === "boolean") {
    return {
      auth: {
        required: policy.auth,
      },
    };
  }
  
  return {
    auth: {
      required: policy.auth.required ?? true,
      roles: policy.auth.roles,
      permissions: policy.auth.permissions,
      check: policy.auth.check,
    },
  };
}

/**
 * Merge two policies (second overrides first)
 */
export function mergePolicies(
  base: ResolvedPolicy,
  override: ResolvedPolicy
): ResolvedPolicy {
  return {
    auth: {
      required: override.auth.required ?? base.auth.required,
      roles: override.auth.roles ?? base.auth.roles,
      permissions: override.auth.permissions ?? base.auth.permissions,
      check: override.auth.check ?? base.auth.check,
    },
  };
}
