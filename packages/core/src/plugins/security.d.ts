import type { PluginManifest } from "./base.js";
/**
 * Plugin security policy
 */
export interface PluginSecurityPolicy {
    /**
     * Requires code signing for this plugin
     */
    requiresCodeSigning?: boolean;
    /**
     * Allowed Node.js APIs (whitelist)
     * e.g., ["fs", "http", "https"]
     */
    allowedAPIs?: string[];
    /**
     * Should plugin run in sandbox
     */
    sandboxed?: boolean;
    /**
     * Trusted publisher (for code signing)
     */
    trustedPublisher?: string;
}
/**
 * Security validation result
 */
export interface SecurityValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
}
/**
 * Validate plugin security policy
 */
export declare function validateSecurityPolicy(manifest: PluginManifest): SecurityValidationResult;
/**
 * Check if plugin is trusted
 */
export declare function isPluginTrusted(manifest: PluginManifest): boolean;
/**
 * Get security warnings for plugin
 */
export declare function getSecurityWarnings(manifest: PluginManifest): string[];
