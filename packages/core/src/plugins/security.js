/**
 * Validate plugin security policy
 */
export function validateSecurityPolicy(manifest) {
    const warnings = [];
    const errors = [];
    const security = manifest.security;
    if (!security) {
        // No security policy - warn if not an official plugin
        const isOfficial = manifest.category &&
            (manifest.category.startsWith("@betagors/") ||
                manifest.category.startsWith("@yama/"));
        if (!isOfficial) {
            warnings.push("Plugin has no security policy defined");
        }
        return { valid: true, warnings, errors };
    }
    // Validate code signing requirement
    if (security.requiresCodeSigning) {
        // In a real implementation, verify code signature
        // For now, just check if it's an official plugin
        const isOfficial = manifest.category &&
            (manifest.category.startsWith("@betagors/") ||
                manifest.category.startsWith("@yama/"));
        if (!isOfficial && !security.trustedPublisher) {
            warnings.push("Plugin requires code signing but no trusted publisher specified");
        }
    }
    // Validate API whitelist
    if (security.allowedAPIs && security.allowedAPIs.length > 0) {
        // In a real implementation, check plugin code for API usage
        // For now, just validate the whitelist format
        const validAPIs = [
            "fs", "path", "http", "https", "crypto", "stream", "util",
            "events", "buffer", "url", "querystring", "os", "net", "tls",
        ];
        for (const api of security.allowedAPIs) {
            if (!validAPIs.includes(api) && !api.startsWith("@")) {
                warnings.push(`Unknown API in whitelist: ${api}`);
            }
        }
    }
    // Sandboxing validation
    if (security.sandboxed) {
        // In a real implementation, this would enable VM2 or isolated-vm
        // For now, just note that sandboxing is requested
        warnings.push("Sandboxing requested but not implemented yet");
    }
    return {
        valid: errors.length === 0,
        warnings,
        errors,
    };
}
/**
 * Check if plugin is trusted
 */
export function isPluginTrusted(manifest) {
    const security = manifest.security;
    // Official plugins are always trusted
    const isOfficial = manifest.category &&
        (manifest.category.startsWith("@betagors/") ||
            manifest.category.startsWith("@yama/"));
    if (isOfficial) {
        return true;
    }
    // Check if plugin has trusted publisher
    if (security?.trustedPublisher) {
        return true;
    }
    // Check code signing
    if (security?.requiresCodeSigning) {
        // In real implementation, verify signature
        return false; // Assume not signed unless verified
    }
    return false; // Community plugins are not trusted by default
}
/**
 * Get security warnings for plugin
 */
export function getSecurityWarnings(manifest) {
    const warnings = [];
    const security = manifest.security;
    if (!security) {
        warnings.push("No security policy defined");
    }
    if (!isPluginTrusted(manifest)) {
        warnings.push("Plugin is not from a trusted source");
    }
    if (security?.sandboxed) {
        warnings.push("Sandboxing is requested but may not be fully enforced");
    }
    return warnings;
}
//# sourceMappingURL=security.js.map