import { getGlobalDatabaseAdapter } from "../../infrastructure/database-registry.js";
/**
 * Resolve environment variable references in strings
 * Supports ${VAR_NAME} syntax
 */
function resolveEnvVar(value) {
    return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
        const envValue = process.env[varName];
        if (envValue === undefined) {
            throw new Error(`Environment variable ${varName} is not set`);
        }
        return envValue;
    });
}
/**
 * Extract credentials from Basic Auth header
 * Format: Authorization: Basic <base64(identifier:password)>
 */
function extractBasicAuthCredentials(authHeader) {
    if (!authHeader)
        return null;
    const match = authHeader.match(/^Basic\s+(.+)$/i);
    if (!match)
        return null;
    try {
        const decoded = Buffer.from(match[1], "base64").toString("utf-8");
        const [identifier, ...passwordParts] = decoded.split(":");
        const password = passwordParts.join(":"); // Handle passwords with colons
        if (!identifier || !password)
            return null;
        return { identifier, password };
    }
    catch {
        return null;
    }
}
/**
 * Compare password with hash using bcrypt
 * Falls back to simple comparison if bcrypt is not available
 */
async function comparePassword(password, hash) {
    try {
        // Try to use bcrypt if available
        // @ts-ignore - optional dependency
        const bcrypt = await import("bcryptjs").catch(() => null);
        if (bcrypt) {
            return await bcrypt.compare(password, hash);
        }
    }
    catch {
        // Fall through to simple comparison
    }
    // Fallback: simple string comparison (not secure, but works for testing)
    // In production, bcryptjs should be installed
    return password === hash;
}
/**
 * Look up user in database
 */
async function lookupUserInDatabase(identifier, config) {
    const dbAdapter = getGlobalDatabaseAdapter();
    if (!dbAdapter) {
        throw new Error("Database adapter not available. Ensure database plugin is loaded.");
    }
    const db = dbAdapter.getClient();
    if (!db) {
        throw new Error("Database client not initialized");
    }
    // Get SQL client for raw queries
    const sql = dbAdapter.getSQL?.();
    if (!sql) {
        throw new Error("SQL client not available for database queries");
    }
    // Determine table name from entity name
    // For now, we'll assume the table name follows a pattern
    // This is a simplified implementation - in practice, you'd want to use
    // the entity registry to get the actual table name
    const tableName = config.userEntity.toLowerCase() + "s"; // Simple pluralization
    const identifierField = config.identifierField || "email"; // Default to email
    const passwordField = config.passwordField || "passwordHash"; // Default to passwordHash
    // Build and execute query
    // Note: This is a simplified implementation. In practice, you'd want to use
    // a proper query builder or ORM that's compatible with the database adapter
    try {
        // For PostgreSQL/postgres, we can use the sql client directly
        if (typeof sql === "object" && sql !== null && "query" in sql) {
            const query = `SELECT * FROM ${tableName} WHERE ${identifierField} = $1 LIMIT 1`;
            const result = await sql.query(query, [identifier]);
            if (Array.isArray(result) && result.length > 0) {
                return result[0];
            }
        }
        // Fallback: try to use drizzle if available
        if (typeof db === "object" && db !== null) {
            // This would require drizzle-specific code, which we'll skip for now
            // In a real implementation, you'd use the entity repository or mapper
        }
    }
    catch (error) {
        throw new Error(`Failed to query database: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
}
/**
 * Basic Auth provider handler
 */
const basicHandler = {
    async validate(headers, config) {
        const credentials = extractBasicAuthCredentials(headers.authorization);
        if (!credentials) {
            return {
                valid: false,
                context: { authenticated: false },
                error: "No Basic Auth credentials provided",
            };
        }
        const { identifier, password } = credentials;
        // Static mode: validate against config values
        if (config.mode === "static") {
            const configIdentifier = resolveEnvVar(config.identifier);
            const configPassword = resolveEnvVar(config.password);
            if (identifier === configIdentifier && password === configPassword) {
                return {
                    valid: true,
                    context: {
                        authenticated: true,
                        provider: "basic",
                        user: {
                            id: identifier,
                        },
                    },
                };
            }
            return {
                valid: false,
                context: { authenticated: false },
                error: "Invalid credentials",
            };
        }
        // Database mode: validate against database
        if (config.mode === "database") {
            try {
                const user = await lookupUserInDatabase(identifier, config);
                if (!user) {
                    return {
                        valid: false,
                        context: { authenticated: false },
                        error: "User not found",
                    };
                }
                const passwordHash = user[config.passwordField || "passwordHash"];
                if (!passwordHash) {
                    return {
                        valid: false,
                        context: { authenticated: false },
                        error: "User has no password set",
                    };
                }
                const passwordValid = await comparePassword(password, passwordHash);
                if (!passwordValid) {
                    return {
                        valid: false,
                        context: { authenticated: false },
                        error: "Invalid password",
                    };
                }
                return {
                    valid: true,
                    context: {
                        authenticated: true,
                        provider: "basic",
                        user: {
                            id: user.id,
                            email: user.email,
                            roles: user.roles,
                            ...user,
                        },
                    },
                };
            }
            catch (error) {
                return {
                    valid: false,
                    context: { authenticated: false },
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }
        return {
            valid: false,
            context: { authenticated: false },
            error: "Invalid Basic Auth configuration",
        };
    },
};
export default basicHandler;
//# sourceMappingURL=basic.js.map