/**
 * Redaction configuration for sensitive data
 */
export interface RedactionConfig {
    /** Keys to redact (e.g., 'password', 'token', 'authorization') */
    keys?: string[];
    /** Paths to redact (e.g., 'user.password', 'headers.authorization') (future enhancement) */
    paths?: string[];
    /** Replacement string (default: '[REDACTED]') */
    replacement?: string;
}

const DEFAULT_REDACT_KEYS = [
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "set-cookie",
    "apiKey",
    "passphrase",
];

const DEFAULT_REPLACEMENT = "[REDACTED]";

/**
 * Redacts sensitive information from an object.
 * This is a core invariant of the logging system.
 */
export function redact(
    data: any,
    config: RedactionConfig = {}
): any {
    if (!data || typeof data !== "object") {
        return data;
    }

    const keysToRedact = new Set([
        ...DEFAULT_REDACT_KEYS,
        ...(config.keys || []),
    ]);
    const replacement = config.replacement || DEFAULT_REPLACEMENT;

    // Simple recursive redaction
    // Note: For extreme performance, this could be optimized to avoid deep copies
    // but safety is the priority in core.
    return redactRecursive(data, keysToRedact, replacement);
}

function redactRecursive(
    obj: any,
    keys: Set<string>,
    replacement: string,
    seen = new WeakSet()
): any {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    // Handle circular references
    if (seen.has(obj)) {
        return "[Circular]";
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
        return obj.map((item) => redactRecursive(item, keys, replacement, seen));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (keys.has(key.toLowerCase())) {
            result[key] = replacement;
        } else if (typeof value === "object" && value !== null) {
            result[key] = redactRecursive(value, keys, replacement, seen);
        } else {
            result[key] = value;
        }
    }
    return result;
}
